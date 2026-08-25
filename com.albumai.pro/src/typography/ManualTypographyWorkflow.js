import {
    createTypographyInventory,
    createTypographyPlan,
    TypographyState
} from "./TypographyPlan";

export const ManualTypographyStatus = Object.freeze({
    SUCCESS: "SUCCESS",
    BLOCKED: "BLOCKED",
    FAILED: "FAILED"
});

export const ManualTypographyReason = Object.freeze({
    TEMPLATE_REQUIRED: "TEMPLATE_REQUIRED",
    DOCUMENT_MISMATCH: "DOCUMENT_MISMATCH",
    NO_ASSIGNMENTS: "NO_ASSIGNMENTS"
});

/**
 * Small production orchestration boundary for user-authored text. Planning is
 * detached and deterministic; Photoshop mutation remains inside the qualified
 * adapter and is therefore one grouped Undo operation.
 */
export default class ManualTypographyWorkflow {

    constructor({ adapter } = {}) {
        if (!adapter || typeof adapter.execute !== "function") {
            throw new Error("PhotoshopTypographyAdapter is required.");
        }
        this.adapter = adapter;
    }

    async execute({ template, expectedDocumentId, assignments } = {}) {
        if (!template?.document || !Array.isArray(template.textLayers)) {
            return this.blocked(ManualTypographyReason.TEMPLATE_REQUIRED);
        }
        if (template.document.id !== expectedDocumentId) {
            return this.blocked(ManualTypographyReason.DOCUMENT_MISMATCH);
        }
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return this.blocked(ManualTypographyReason.NO_ASSIGNMENTS);
        }

        const inventory = createTypographyInventory(template.textLayers);
        const plan = createTypographyPlan({
            templateId: String(template.filePath || template.name || template.id),
            inventory,
            assignments
        });

        if (plan.state !== TypographyState.READY) {
            return this.blocked(plan.reasonCodes[0] || "PLAN_BLOCKED", { plan });
        }

        const execution = await this.adapter.execute({ plan, expectedDocumentId });
        return {
            status: execution.status === ManualTypographyStatus.SUCCESS
                ? ManualTypographyStatus.SUCCESS
                : ManualTypographyStatus.FAILED,
            reasonCode: execution.reasonCode || null,
            plan,
            execution,
            completedLayerIds: execution.completedLayerIds || [],
            failedLayerId: execution.failedLayerId ?? null
        };
    }

    blocked(reasonCode, extra = {}) {
        return {
            status: ManualTypographyStatus.BLOCKED,
            reasonCode,
            completedLayerIds: [],
            failedLayerId: null,
            ...extra
        };
    }
}
