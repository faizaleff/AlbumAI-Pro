import { app } from "photoshop";

import TemplateLayerTreeReader from "../services/TemplateLayerTreeReader";
import PhotoshopTypographyAdapter, {
    TypographyExecutionStatus
} from "./PhotoshopTypographyAdapter";
import {
    createTypographyInventory,
    createTypographyPlan,
    TypographyState
} from "./TypographyPlan";

export const TypographyQualificationStatus = Object.freeze({
    READY: "READY",
    SUCCESS: "SUCCESS",
    BLOCKED: "BLOCKED",
    FAILED: "FAILED"
});

export const TypographyQualificationReason = Object.freeze({
    NO_ACTIVE_DOCUMENT: "NO_ACTIVE_DOCUMENT",
    CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
    EXPECTED_DOCUMENT_REQUIRED: "EXPECTED_DOCUMENT_REQUIRED",
    DOCUMENT_MISMATCH: "DOCUMENT_MISMATCH",
    INSUFFICIENT_TEXT_LAYERS: "INSUFFICIENT_TEXT_LAYERS",
    EXACTLY_TWO_ASSIGNMENTS_REQUIRED: "EXACTLY_TWO_ASSIGNMENTS_REQUIRED",
    INVENTORY_BLOCKED: "INVENTORY_BLOCKED",
    PLAN_BLOCKED: "PLAN_BLOCKED",
    EXECUTION_FAILED: "EXECUTION_FAILED"
});

/**
 * Developer-console-only qualification boundary for ALB-119.
 * It never saves or exports a document and refuses mutation unless the caller
 * confirms a disposable fixture and supplies the exact active document id.
 */
export default class TypographyRuntimeQualification {

    constructor({
        photoshopApp = app,
        layerTreeReader = new TemplateLayerTreeReader(),
        adapter = new PhotoshopTypographyAdapter()
    } = {}) {

        this.photoshopApp = photoshopApp;
        this.layerTreeReader = layerTreeReader;
        this.adapter = adapter;

    }

    inspect() {

        const document = this.activeDocument();

        if (!document) {
            return this.result({
                status: TypographyQualificationStatus.BLOCKED,
                reasonCode: TypographyQualificationReason.NO_ACTIVE_DOCUMENT
            });
        }

        try {
            this.layerTreeReader.read(document);
            const inventory = createTypographyInventory(
                this.layerTreeReader.textLayers()
            );

            if (inventory.state === TypographyState.READY && inventory.slots.length < 2) {
                return this.result({
                    status: TypographyQualificationStatus.BLOCKED,
                    reasonCode: TypographyQualificationReason.INSUFFICIENT_TEXT_LAYERS,
                    documentId: document.id,
                    textLayerCount: inventory.slots.length,
                    textLayers: []
                });
            }

            if (inventory.state !== TypographyState.READY) {
                return this.result({
                    status: TypographyQualificationStatus.BLOCKED,
                    reasonCode: TypographyQualificationReason.INVENTORY_BLOCKED,
                    documentId: document.id,
                    inventoryReasonCodes: inventory.reasonCodes
                });
            }

            return this.result({
                status: TypographyQualificationStatus.READY,
                documentId: document.id,
                textLayerCount: inventory.slots.length,
                textLayers: inventory.slots.map(slot => ({
                    layerId: slot.layerId,
                    layerName: slot.layerName,
                    editable: slot.editable,
                    currentText: slot.currentText,
                    style: slot.style
                }))
            });
        } finally {
            this.layerTreeReader.clear();
        }

    }

    async execute({
        confirmDisposableDocument = false,
        expectedDocumentId,
        templateId,
        assignments
    } = {}) {

        if (confirmDisposableDocument !== true) {
            return this.blocked(TypographyQualificationReason.CONFIRMATION_REQUIRED);
        }

        if (!isDocumentId(expectedDocumentId)) {
            return this.blocked(TypographyQualificationReason.EXPECTED_DOCUMENT_REQUIRED);
        }

        if (!Array.isArray(assignments) || assignments.length !== 2) {
            return this.blocked(
                TypographyQualificationReason.EXACTLY_TWO_ASSIGNMENTS_REQUIRED,
                expectedDocumentId
            );
        }

        const document = this.activeDocument();

        if (!document) {
            return this.blocked(
                TypographyQualificationReason.NO_ACTIVE_DOCUMENT,
                expectedDocumentId
            );
        }

        if (document.id !== expectedDocumentId) {
            return this.blocked(
                TypographyQualificationReason.DOCUMENT_MISMATCH,
                expectedDocumentId,
                { activeDocumentId: document.id }
            );
        }

        try {
            this.layerTreeReader.read(document);
            const inventory = createTypographyInventory(
                this.layerTreeReader.textLayers()
            );

            if (inventory.state === TypographyState.READY && inventory.slots.length < 2) {
                return this.blocked(
                    TypographyQualificationReason.INSUFFICIENT_TEXT_LAYERS,
                    expectedDocumentId,
                    { textLayerCount: inventory.slots.length }
                );
            }

            if (inventory.state !== TypographyState.READY) {
                return this.blocked(
                    TypographyQualificationReason.INVENTORY_BLOCKED,
                    expectedDocumentId,
                    { inventoryReasonCodes: inventory.reasonCodes }
                );
            }

            const plan = createTypographyPlan({
                templateId: templateId || `ALB-120-${expectedDocumentId}`,
                inventory,
                assignments
            });

            if (plan.state !== TypographyState.READY) {
                return this.blocked(
                    TypographyQualificationReason.PLAN_BLOCKED,
                    expectedDocumentId,
                    { planReasonCodes: plan.reasonCodes }
                );
            }

            const execution = await this.adapter.execute({
                plan,
                expectedDocumentId
            });

            return this.result({
                status: execution.status === TypographyExecutionStatus.SUCCESS
                    ? TypographyQualificationStatus.SUCCESS
                    : TypographyQualificationStatus.FAILED,
                reasonCode: execution.status === TypographyExecutionStatus.SUCCESS
                    ? null
                    : TypographyQualificationReason.EXECUTION_FAILED,
                documentId: expectedDocumentId,
                planStepCount: plan.steps.length,
                targetLayerIds: plan.steps.map(step => step.layerId),
                executionStatus: execution.status,
                executionReasonCode: execution.reasonCode,
                completedLayerIds: execution.completedLayerIds,
                failedLayerId: execution.failedLayerId
            });
        } finally {
            this.layerTreeReader.clear();
        }

    }

    activeDocument() {

        try {
            return this.photoshopApp?.activeDocument || null;
        } catch {
            return null;
        }

    }

    blocked(reasonCode, documentId = null, extra = {}) {

        return this.result({
            status: TypographyQualificationStatus.BLOCKED,
            reasonCode,
            documentId,
            ...extra
        });

    }

    result(fields) {

        return deepFreeze({
            qualification: "ALB-120",
            ...fields
        });

    }

}

function isDocumentId(value) {

    return (Number.isInteger(value) && value >= 0) ||
        (typeof value === "string" && value.trim().length > 0);

}

function deepFreeze(value) {

    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(item => deepFreeze(item));
    return Object.freeze(value);

}
