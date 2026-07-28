export const BatchExecutionStatus = Object.freeze({
    IDLE: "IDLE",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS",
    CANCEL_REQUESTED: "CANCEL_REQUESTED",
    CANCELLING: "CANCELLING",
    CANCELLED: "CANCELLED",
    FAILED: "FAILED"
});

/** Serializable immutable outcome of a multi-template batch. */
export default class BatchExecutionResult {

    constructor(data = {}) {

        return BatchExecutionResult.freeze({
            status: data.status || BatchExecutionStatus.IDLE,
            totalTemplates: data.totalTemplates || 0,
            completedTemplates: data.completedTemplates || 0,
            successfulTemplates: data.successfulTemplates || 0,
            failedTemplates: data.failedTemplates || 0,
            skippedTemplates: data.skippedTemplates || 0,
            startedAt: data.startedAt || null,
            completedAt: data.completedAt || null,
            durationMs: data.durationMs || 0,
            templateResults: data.templateResults || [],
            warnings: data.warnings || [],
            fatalError: data.fatalError || null,
            currentTemplate: data.currentTemplate || null,
            templateIndex: Number.isInteger(data.templateIndex) ? data.templateIndex : null,
            pendingTemplates: data.pendingTemplates || 0,
            cancelReason: data.cancelReason || null,
            cancelledAtTemplateId: data.cancelledAtTemplateId || null,
            cancelledAtStage: data.cancelledAtStage || null
            ,retainedProgressPercent: Number(data.retainedProgressPercent) || 0
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(item => BatchExecutionResult.freeze(item));
        return Object.freeze(value);

    }

}
