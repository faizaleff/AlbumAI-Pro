export const BATCH_RECOVERY_SCHEMA_VERSION = 3;

/** Immutable, serializable orchestration checkpoint for a project batch. */
export default class BatchRecoverySnapshot {

    constructor(data = {}) {
        return BatchRecoverySnapshot.freeze({
            schemaVersion: BATCH_RECOVERY_SCHEMA_VERSION,
            recoveryVersion: Number.isInteger(data.recoveryVersion) ? data.recoveryVersion : 1,
            projectId: data.projectId ?? null,
            batchId: data.batchId || BatchRecoverySnapshot.id(),
            registryVersion: data.registryVersion || "",
            registrySnapshot: data.registrySnapshot || [],
            queueOrder: data.queueOrder || [],
            lifecycle: data.lifecycle || "IDLE",
            startedAt: data.startedAt || null,
            updatedAt: data.updatedAt || new Date().toISOString(),
            completedTemplateIds: data.completedTemplateIds || [],
            successfulTemplateIds: data.successfulTemplateIds || [],
            failedTemplateIds: data.failedTemplateIds || [],
            pendingTemplateIds: data.pendingTemplateIds || [],
            currentTemplateId: data.currentTemplateId ?? null,
            currentTemplateIndex: Number.isInteger(data.currentTemplateIndex)
                ? data.currentTemplateIndex
                : null,
            lastCompletedStage: data.lastCompletedStage || "IDLE",
            templateOutcomes: data.templateOutcomes || [],
            warnings: data.warnings || [],
            fatalError: data.fatalError || null,
            runMode: data.runMode || "PROCESS_PROJECT"
            ,cancellationRequestedAt: data.cancellationRequestedAt || null
            ,cancellationEffectiveAt: data.cancellationEffectiveAt || null
            ,cancellationReason: data.cancellationReason || null
            ,cancelledAtStage: data.cancelledAtStage || null
            ,retainedProgressPercent: Number(data.retainedProgressPercent) || 0
            ,selectedPhotoOrder: data.selectedPhotoOrder || []
            ,photoCursor: Number.isInteger(data.photoCursor) ? data.photoCursor : 0
            ,consumedPhotoIds: data.consumedPhotoIds || []
            ,remainingPhotoIds: data.remainingPhotoIds || []
        });
    }

    static id() {
        return typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `batch-${Date.now()}-${Math.random()}`;
    }

    static validatePersisted(data = {}) {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return BatchRecoverySnapshot.validation("INVALID", ["Recovery data must be an object."]);
        }
        if (!Number.isInteger(data.schemaVersion)) {
            return BatchRecoverySnapshot.validation("INVALID", ["Recovery schema version is missing."]);
        }
        if (data.schemaVersion > BATCH_RECOVERY_SCHEMA_VERSION) {
            return BatchRecoverySnapshot.validation("INCOMPATIBLE", [
                `Recovery schema ${data.schemaVersion} is newer than supported schema ${BATCH_RECOVERY_SCHEMA_VERSION}.`
            ]);
        }
        if (data.schemaVersion < 1) {
            return BatchRecoverySnapshot.validation("INVALID", ["Recovery schema version is invalid."]);
        }

        const reasons = [];
        const arrayFields = [
            "registrySnapshot", "queueOrder", "completedTemplateIds",
            "successfulTemplateIds", "failedTemplateIds", "pendingTemplateIds",
            "templateOutcomes", "warnings", "selectedPhotoOrder",
            "consumedPhotoIds", "remainingPhotoIds"
        ];
        arrayFields.forEach(field => {
            if (data[field] != null && !Array.isArray(data[field])) {
                reasons.push(`${field} must be an array.`);
            }
        });
        const idArrayFields = [
            "queueOrder", "completedTemplateIds", "successfulTemplateIds",
            "failedTemplateIds", "pendingTemplateIds", "selectedPhotoOrder",
            "consumedPhotoIds", "remainingPhotoIds"
        ];
        idArrayFields.forEach(field => {
            if (!Array.isArray(data[field])) return;
            if (data[field].some(id => typeof id !== "string" || !id)) {
                reasons.push(`${field} contains an invalid id.`);
            }
            if (new Set(data[field]).size !== data[field].length) {
                reasons.push(`${field} contains duplicate ids.`);
            }
        });
        if (data.projectId != null && typeof data.projectId !== "string") {
            reasons.push("projectId must be a string or null.");
        }
        if (data.registryVersion != null && typeof data.registryVersion !== "string") {
            reasons.push("registryVersion must be a string.");
        }
        if (data.photoCursor != null && (!Number.isInteger(data.photoCursor) || data.photoCursor < 0)) {
            reasons.push("photoCursor must be a non-negative integer.");
        }
        if (Array.isArray(data.selectedPhotoOrder) &&
            Number.isInteger(data.photoCursor) &&
            data.photoCursor > data.selectedPhotoOrder.length) {
            reasons.push("photoCursor exceeds the selected photo order.");
        }
        if (Array.isArray(data.templateOutcomes) && data.templateOutcomes.some(
            item => !item || typeof item !== "object" || Array.isArray(item) ||
                typeof item.templateId !== "string" || !item.templateId
        )) {
            reasons.push("templateOutcomes contains an invalid template outcome.");
        }

        return BatchRecoverySnapshot.validation(
            reasons.length ? "INVALID" : "VALID",
            reasons
        );
    }

    static validation(status, reasons) {
        return Object.freeze({
            status,
            valid: status === "VALID",
            reasons: Object.freeze(reasons.slice())
        });
    }

    static freeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(item => BatchRecoverySnapshot.freeze(item));
        return Object.freeze(value);
    }

    toJSON() {
        return { ...this };
    }
}
