export default class ReplacementResult {

    constructor(data = {}) {

        return ReplacementResult.freeze({
            requestId: data.requestId ?? null,
            status: data.status || "PENDING",
            completedSteps: data.completedSteps || [],
            failedSteps: data.failedSteps || [],
            warnings: data.warnings || [],
            errors: data.errors || [],
            startedAt: data.startedAt || null,
            finishedAt: data.finishedAt || null
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => ReplacementResult.freeze(item));

        return Object.freeze(value);

    }

}
