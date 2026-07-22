export const ProjectExecutionStatus = Object.freeze({
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

export default class ProjectExecutionSummary {

    constructor(data = {}) {

        return ProjectExecutionSummary.freeze({
            projectId: data.projectId ?? null,
            totalTemplates: data.totalTemplates || 0,
            completedTemplates: data.completedTemplates || 0,
            failedTemplates: data.failedTemplates || 0,
            templateResults: data.templateResults || [],
            startedAt: data.startedAt || null,
            finishedAt: data.finishedAt || null,
            elapsedMilliseconds: data.elapsedMilliseconds || 0,
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
