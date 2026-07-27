export const BATCH_RECOVERY_SCHEMA_VERSION = 2;

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

    static freeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(item => BatchRecoverySnapshot.freeze(item));
        return Object.freeze(value);
    }

    toJSON() {
        return { ...this };
    }
}
