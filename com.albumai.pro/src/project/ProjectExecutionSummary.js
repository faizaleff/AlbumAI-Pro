export const ProjectExecutionStatus = Object.freeze({
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

export const ProjectBatchStage = Object.freeze({
    IDLE: "IDLE", OPENING: "OPENING", VALIDATING: "VALIDATING",
    PLANNING: "PLANNING", REPLACING: "REPLACING", SAVING: "SAVING",
    EXPORTING: "EXPORTING", CLOSING: "CLOSING", COMPLETED: "COMPLETED", FAILED: "FAILED"
});

export default class ProjectExecutionSummary {

    constructor(data = {}) {

        return ProjectExecutionSummary.freeze({
            projectId: data.projectId ?? null,
            totalTemplates: data.totalTemplates || 0,
            completedTemplates: data.completedTemplates || 0,
            successfulTemplates: data.successfulTemplates ?? data.completedTemplates ?? 0,
            failedTemplates: data.failedTemplates || 0,
            skippedTemplates: data.skippedTemplates || 0,
            templateResults: data.templateResults || [],
            batchExecution: data.batchExecution || null,
            batchProgress: data.batchProgress || {
                lifecycle: "IDLE", stage: ProjectBatchStage.IDLE,
                currentTemplate: null, templateIndex: null, totalTemplates: data.totalTemplates || 0,
                completedTemplates: data.completedTemplates || 0,
                successfulTemplates: data.successfulTemplates ?? data.completedTemplates ?? 0,
                failedTemplates: data.failedTemplates || 0
                ,skippedTemplates: data.skippedTemplates || 0
            },
            startedAt: data.startedAt || null,
            finishedAt: data.finishedAt || null,
            elapsedMilliseconds: data.elapsedMilliseconds || 0,
            // This is deliberately independent of placement validation.
            registeredTemplates: Number.isInteger(data.registeredTemplates)
                ? data.registeredTemplates
                : (data.totalTemplates || 0),
            registryValidationError: data.registryValidationError || null,
            status: data.status || ProjectExecutionStatus.RUNNING
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => ProjectExecutionSummary.freeze(item));

        return Object.freeze(value);

    }

}
