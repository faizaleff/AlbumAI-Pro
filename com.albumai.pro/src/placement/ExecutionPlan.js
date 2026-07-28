export default class ExecutionPlan {

    constructor(data = {}) {

        return ExecutionPlan.freeze({
            id: data.id ?? null,
            projectId: data.projectId ?? null,
            templateId: data.templateId ?? null,
            templateDocumentId: data.templateDocumentId ?? null,
            steps: data.steps || [],
            warnings: data.warnings || [],
            statistics: data.statistics || {},
            createdAt: data.createdAt || null,
            status: "READY"
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => ExecutionPlan.freeze(item));

        return Object.freeze(value);

    }

}
