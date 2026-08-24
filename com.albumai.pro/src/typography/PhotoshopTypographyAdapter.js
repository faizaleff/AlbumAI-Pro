import { app } from "photoshop";

import DocumentManager from "../core/document/DocumentManager";
import LayerManager from "../core/layers/LayerManager";
import BatchPlay from "../core/photoshop/BatchPlay";
import ExecuteModal from "../core/photoshop/ExecuteModal";
import Logger from "../core/photoshop/Logger";

export const TypographyExecutionStatus = Object.freeze({
    SUCCESS: "SUCCESS",
    FAILED: "FAILED"
});

export const TypographyExecutionReason = Object.freeze({
    PLAN_NOT_READY: "PLAN_NOT_READY",
    DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",
    TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
    TARGET_NOT_TEXT_LAYER: "TARGET_NOT_TEXT_LAYER",
    TARGET_NOT_EDITABLE: "TARGET_NOT_EDITABLE",
    FONT_UNAVAILABLE: "FONT_UNAVAILABLE",
    HISTORY_UNAVAILABLE: "HISTORY_UNAVAILABLE",
    PHOTOSHOP_REJECTED: "PHOTOSHOP_REJECTED",
    VERIFICATION_FAILED: "VERIFICATION_FAILED"
});

const ALIGNMENT_VALUES = Object.freeze({
    left: "left",
    center: "center",
    right: "right",
    justify: "justifyAll"
});

class PhotoshopFontCatalog {

    hasExact(fontFamily) {

        const fonts = app?.fonts;

        if (!fonts) return false;

        if (typeof fonts.getByPostScriptName === "function") {
            try {
                return Boolean(fonts.getByPostScriptName(fontFamily));
            } catch {
                return false;
            }
        }

        try {
            return [...fonts].some(font => font?.postScriptName === fontFamily);
        } catch {
            return false;
        }

    }

}

/**
 * Fail-closed Photoshop boundary for a READY ALB-118 typography plan.
 * The adapter performs no role inference and targets only exact document and
 * layer identities already validated by the detached domain plan.
 */
export default class PhotoshopTypographyAdapter {

    constructor({
        documentManager = new DocumentManager(),
        layerManager = new LayerManager(),
        batchPlay = BatchPlay,
        executeModal = ExecuteModal,
        fontCatalog = new PhotoshopFontCatalog()
    } = {}) {

        this.documentManager = documentManager;
        this.layerManager = layerManager;
        this.batchPlay = batchPlay;
        this.executeModal = executeModal;
        this.fontCatalog = fontCatalog;

    }

    async execute({ plan, expectedDocumentId } = {}) {

        const startedAt = new Date().toISOString();
        let failedLayerId = null;

        try {
            const context = await this.preflight(plan, expectedDocumentId);

            if (context.steps.length === 0) {
                return this.result({
                    status: TypographyExecutionStatus.SUCCESS,
                    plan,
                    expectedDocumentId,
                    completedLayerIds: [],
                    startedAt
                });
            }

            const completedLayerIds = await this.executeTransaction(context, layerId => {
                failedLayerId = layerId;
            });

            return this.result({
                status: TypographyExecutionStatus.SUCCESS,
                plan,
                expectedDocumentId,
                completedLayerIds,
                startedAt
            });
        } catch (error) {
            const reasonCode = this.reason(error);
            Logger.warn(
                `[AlbumAI:typography] EXECUTION_FAILED doc=${expectedDocumentId ?? "none"} ` +
                `layer=${failedLayerId ?? "none"} reason=${reasonCode}`
            );
            return this.result({
                status: TypographyExecutionStatus.FAILED,
                plan,
                expectedDocumentId,
                failedLayerId,
                reasonCode,
                startedAt
            });
        }

    }

    async preflight(plan, expectedDocumentId) {

        if (!plan || plan.state !== "READY" || !Array.isArray(plan.steps)) {
            throw this.failure(TypographyExecutionReason.PLAN_NOT_READY);
        }

        if (expectedDocumentId == null) {
            throw this.failure(TypographyExecutionReason.DOCUMENT_NOT_FOUND);
        }

        const document = this.documentManager.byId(expectedDocumentId);

        if (!document) {
            throw this.failure(TypographyExecutionReason.DOCUMENT_NOT_FOUND);
        }

        if (this.documentManager.activeId !== document.id) {
            await this.documentManager.activate(document);
        }

        if (this.documentManager.activeId !== expectedDocumentId) {
            throw this.failure(TypographyExecutionReason.DOCUMENT_NOT_FOUND);
        }

        this.layerManager.scan(document);
        const steps = [];

        for (const step of plan.steps) {
            const layer = this.layerManager.byId(step.layerId);

            if (!layer) {
                throw this.failure(TypographyExecutionReason.TARGET_NOT_FOUND, step.layerId);
            }
            if (layer.kind !== "textLayer") {
                throw this.failure(TypographyExecutionReason.TARGET_NOT_TEXT_LAYER, step.layerId);
            }
            if (layer.visible === false || layer.locked === true) {
                throw this.failure(TypographyExecutionReason.TARGET_NOT_EDITABLE, step.layerId);
            }
            if (step.preset?.fontFamily &&
                !await this.fontCatalog.hasExact(step.preset.fontFamily)) {
                throw this.failure(TypographyExecutionReason.FONT_UNAVAILABLE, step.layerId);
            }

            steps.push({ ...step, layer });
        }

        return { document, expectedDocumentId, plan, steps };

    }

    async executeTransaction(context, stepStarted) {

        return this.executeModal.run(async executionContext => {
            const hostControl = executionContext?.hostControl;

            if (typeof hostControl?.suspendHistory !== "function" ||
                typeof hostControl?.resumeHistory !== "function") {
                throw this.failure(TypographyExecutionReason.HISTORY_UNAVAILABLE);
            }

            const suspensionId = await hostControl.suspendHistory({
                documentID: context.expectedDocumentId,
                name: "Apply Album Typography"
            });
            const completedLayerIds = [];

            try {
                for (const step of context.steps) {
                    stepStarted(step.layerId);
                    await this.batchPlay.execute([
                        this.setTextDescriptor(step)
                    ], {
                        commandName: `Set Typography Layer ${step.layerId}`,
                        alreadyInModal: true
                    });
                    const verified = await this.batchPlay.command(
                        this.getTextDescriptor(step.layerId),
                        {
                            commandName: `Verify Typography Layer ${step.layerId}`,
                            alreadyInModal: true
                        }
                    );
                    if (verified?.textKey !== step.text) {
                        throw this.failure(
                            TypographyExecutionReason.VERIFICATION_FAILED,
                            step.layerId
                        );
                    }
                    completedLayerIds.push(step.layerId);
                }

                await hostControl.resumeHistory(suspensionId, true);
                return completedLayerIds;
            } catch (error) {
                await hostControl.resumeHistory(suspensionId, false);
                throw error;
            }
        }, { commandName: "Apply Album Typography" });

    }

    setTextDescriptor(step) {

        const to = {
            _obj: "textLayer",
            textKey: step.text
        };
        const preset = step.preset;

        if (preset) {
            const textStyle = { _obj: "textStyle" };

            if (preset.fontFamily) textStyle.fontPostScriptName = preset.fontFamily;
            if (preset.fontSize != null) {
                textStyle.size = { _unit: "pointsUnit", _value: preset.fontSize };
            }
            if (preset.color) {
                textStyle.color = {
                    _obj: "RGBColor",
                    red: preset.color.red,
                    grain: preset.color.green,
                    blue: preset.color.blue
                };
            }
            if (Object.keys(textStyle).length > 1) {
                to.textStyleRange = [{
                    _obj: "textStyleRange",
                    from: 0,
                    to: step.text.length,
                    textStyle
                }];
            }
            if (preset.alignment) {
                to.paragraphStyleRange = [{
                    _obj: "paragraphStyleRange",
                    from: 0,
                    to: step.text.length,
                    paragraphStyle: {
                        _obj: "paragraphStyle",
                        align: {
                            _enum: "alignmentType",
                            _value: ALIGNMENT_VALUES[preset.alignment] || preset.alignment
                        }
                    }
                }];
            }
        }

        return {
            _obj: "set",
            _target: [{ _ref: "textLayer", _id: step.layerId }],
            to
        };

    }

    getTextDescriptor(layerId) {

        return {
            _obj: "get",
            _target: [
                { _property: "textKey" },
                { _ref: "textLayer", _id: layerId }
            ]
        };

    }

    failure(reasonCode, layerId = null) {

        const error = new Error(reasonCode);
        error.typographyReasonCode = reasonCode;
        error.layerId = layerId;
        return error;

    }

    reason(error) {

        return Object.values(TypographyExecutionReason).includes(
            error?.typographyReasonCode
        ) ? error.typographyReasonCode : TypographyExecutionReason.PHOTOSHOP_REJECTED;

    }

    result({
        status,
        plan,
        expectedDocumentId,
        completedLayerIds = [],
        failedLayerId = null,
        reasonCode = null,
        startedAt
    }) {

        return deepFreeze({
            status,
            templateId: plan?.templateId ?? null,
            documentId: expectedDocumentId ?? null,
            completedLayerIds,
            failedLayerId,
            reasonCode,
            startedAt,
            finishedAt: new Date().toISOString()
        });

    }

}

function deepFreeze(value) {

    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(item => deepFreeze(item));
    return Object.freeze(value);

}
