import { app, constants } from "photoshop";

import DocumentManager from "../core/document/DocumentManager";
import LayerManager from "../core/layers/LayerManager";
import ExecuteModal from "../core/photoshop/ExecuteModal";
import Logger from "../core/photoshop/Logger";

const PLACEMENT_ANCHORS = new Set([
    "TOP_LEFT",
    "TOP_CENTER",
    "TOP_RIGHT",
    "BOTTOM_LEFT",
    "BOTTOM_CENTER",
    "BOTTOM_RIGHT"
]);

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
    VERIFICATION_FAILED: "VERIFICATION_FAILED",
    PLACEMENT_UNAVAILABLE: "PLACEMENT_UNAVAILABLE"
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
        executeModal = ExecuteModal,
        fontCatalog = new PhotoshopFontCatalog(),
        photoshopApp = app,
        photoshopConstants = constants
    } = {}) {

        this.documentManager = documentManager;
        this.layerManager = layerManager;
        this.executeModal = executeModal;
        this.fontCatalog = fontCatalog;
        this.photoshopApp = photoshopApp;
        this.photoshopConstants = photoshopConstants;

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
        const dimensions = this.dimensions(document);

        if (plan.steps.some(step => step.placement) && !dimensions) {
            throw this.failure(TypographyExecutionReason.PLACEMENT_UNAVAILABLE);
        }

        for (const step of plan.steps) {
            const layer = this.layerManager.byId(step.layerId);

            if (!layer) {
                throw this.failure(TypographyExecutionReason.TARGET_NOT_FOUND, step.layerId);
            }
            if (layer.kind !== "textLayer") {
                throw this.failure(TypographyExecutionReason.TARGET_NOT_TEXT_LAYER, step.layerId);
            }
            if (!layer.photoshopLayer?.textItem) {
                throw this.failure(TypographyExecutionReason.TARGET_NOT_TEXT_LAYER, step.layerId);
            }
            if (layer.visible === false || layer.locked === true) {
                throw this.failure(TypographyExecutionReason.TARGET_NOT_EDITABLE, step.layerId);
            }
            if (step.preset?.fontFamily &&
                !await this.fontCatalog.hasExact(step.preset.fontFamily)) {
                throw this.failure(TypographyExecutionReason.FONT_UNAVAILABLE, step.layerId);
            }
            if (step.placement) {
                const bounds = this.bounds(layer.photoshopLayer?.bounds ?? layer.bounds);
                if (typeof layer.photoshopLayer?.translate !== "function" ||
                    !PLACEMENT_ANCHORS.has(step.placement.anchor) ||
                    !bounds ||
                    !this.placementTarget(bounds, dimensions, step.placement.anchor)) {
                    throw this.failure(
                        TypographyExecutionReason.PLACEMENT_UNAVAILABLE,
                        step.layerId
                    );
                }
            }

            steps.push({ ...step, layer });
        }

        return { document, expectedDocumentId, plan, steps, dimensions };

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
                    try {
                        await this.applyTextStep(
                            step,
                            context.dimensions,
                            context.document
                        );
                    } catch (error) {
                        Logger.warn(
                            `[AlbumAI:typography] STEP_REJECTED doc=${context.expectedDocumentId} ` +
                            `layer=${step.layerId} error=${this.describeError(error)}`
                        );
                        throw error;
                    }
                    completedLayerIds.push(step.layerId);
                }

                await hostControl.resumeHistory(suspensionId, true);
                return completedLayerIds;
            } catch (error) {
                try {
                    await hostControl.resumeHistory(suspensionId, false);
                } catch (rollbackError) {
                    Logger.error(
                        `[AlbumAI:typography] ROLLBACK_FAILED doc=${context.expectedDocumentId} ` +
                        `error=${this.describeError(rollbackError)}`
                    );
                }
                throw error;
            }
        }, { commandName: "Apply Album Typography" });

    }

    async applyTextStep(step, dimensions, document) {

        const textItem = step.layer.photoshopLayer.textItem;
        const preset = step.preset;

        textItem.contents = step.text;

        if (preset) {
            if (preset.fontFamily) {
                textItem.characterStyle.font = preset.fontFamily;
            }
            if (preset.fontSize != null) {
                textItem.characterStyle.size = preset.fontSize;
            }
            if (preset.color) {
                const SolidColor = this.photoshopApp?.SolidColor;

                if (typeof SolidColor !== "function") {
                    throw this.failure(TypographyExecutionReason.PHOTOSHOP_REJECTED, step.layerId);
                }

                const color = new SolidColor();
                color.rgb.red = preset.color.red;
                color.rgb.green = preset.color.green;
                color.rgb.blue = preset.color.blue;
                textItem.characterStyle.color = color;
            }
            if (preset.alignment) {
                textItem.paragraphStyle.justification = this.justification(
                    preset.alignment,
                    step.layerId
                );
            }
        }

        if (textItem.contents !== step.text) {
            throw this.failure(
                TypographyExecutionReason.VERIFICATION_FAILED,
                step.layerId
            );
        }

        if (step.placement) {
            this.activatePlacementLayer(document, step);
            const bounds = this.bounds(step.layer.photoshopLayer.bounds ?? step.layer.bounds);
            const target = bounds && this.placementTarget(
                bounds,
                dimensions,
                step.placement.anchor
            );
            if (!target) {
                throw this.failure(
                    TypographyExecutionReason.PLACEMENT_UNAVAILABLE,
                    step.layerId
                );
            }
            const horizontal = this.pixelValue(target.left - bounds.left);
            const vertical = this.pixelValue(target.top - bounds.top);

            try {
                await step.layer.photoshopLayer.translate(horizontal, vertical);
            } catch (error) {
                Logger.warn(
                    `[AlbumAI:typography] TRANSLATE_REJECTED layer=${step.layerId} ` +
                    `dx=${horizontal._value} dy=${vertical._value} ` +
                    `error=${this.describeError(error)}`
                );
                throw error;
            }
        }

    }

    dimensions(document) {

        const width = this.number(document?.width);
        const height = this.number(document?.height);

        return width > 0 && height > 0 ? { width, height } : null;

    }

    bounds(bounds) {

        const normalized = {
            left: this.number(bounds?.left),
            top: this.number(bounds?.top),
            right: this.number(bounds?.right),
            bottom: this.number(bounds?.bottom)
        };

        return Object.values(normalized).every(Number.isFinite) &&
            normalized.right > normalized.left &&
            normalized.bottom > normalized.top ? normalized : null;

    }

    number(value) {

        if (typeof value === "number") return value;
        if (typeof value?.value === "number") return value.value;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;

    }

    pixelValue(value) {

        return {
            _unit: "pixelsUnit",
            _value: Math.round(value * 1000) / 1000
        };

    }

    activatePlacementLayer(document, step) {

        try {
            document.activeLayers = [step.layer.photoshopLayer];
            const activeLayers = Array.from(document.activeLayers || []);

            if (activeLayers.length !== 1 || activeLayers[0]?.id !== step.layerId) {
                throw this.failure(
                    TypographyExecutionReason.TARGET_NOT_FOUND,
                    step.layerId
                );
            }
        } catch (error) {
            if (error?.typographyReasonCode) throw error;
            throw this.failure(
                TypographyExecutionReason.PHOTOSHOP_REJECTED,
                step.layerId
            );
        }

    }

    placementTarget(bounds, dimensions, anchor) {

        const margin = Math.max(24, Math.round(Math.min(
            dimensions.width,
            dimensions.height
        ) * 0.04));
        const width = bounds.right - bounds.left;
        const height = bounds.bottom - bounds.top;
        if (width > dimensions.width - (margin * 2) ||
            height > dimensions.height - (margin * 2)) {
            return null;
        }
        const horizontal = anchor.endsWith("_LEFT")
            ? margin
            : anchor.endsWith("_RIGHT")
                ? dimensions.width - margin - width
                : (dimensions.width - width) / 2;
        const vertical = anchor.startsWith("TOP_")
            ? margin
            : dimensions.height - margin - height;

        return { left: horizontal, top: vertical };

    }

    justification(alignment, layerId) {

        const values = this.photoshopConstants?.Justification;
        const mapping = {
            left: values?.LEFT,
            center: values?.CENTER,
            right: values?.RIGHT,
            justify: values?.FULLYJUSTIFIED
        };
        const value = mapping[alignment];

        if (value == null) {
            throw this.failure(TypographyExecutionReason.PHOTOSHOP_REJECTED, layerId);
        }

        return value;

    }

    describeError(error) {

        if (error instanceof Error) {
            const details = [
                `${error.name || "Error"}:${error.message || "unknown"}`,
                error.number != null ? `number=${error.number}` : null,
                error.code != null ? `code=${error.code}` : null
            ].filter(Boolean);
            return details.join(" ");
        }
        if (typeof error === "string") return error;

        try {
            return JSON.stringify(error) || "unknown";
        } catch {
            return "unserializable";
        }

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
