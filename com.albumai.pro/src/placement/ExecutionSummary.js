export const ExecutionStatus = Object.freeze({
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

export default class ExecutionSummary {

    constructor(data = {}) {

        return ExecutionSummary.freeze({
            requestId: data.requestId ?? null,
            totalSteps: data.totalSteps || 0,
            completedSteps: data.completedSteps || 0,
            failedSteps: data.failedSteps || 0,
            skippedSteps: data.skippedSteps || 0,
            results: data.results || [],
            startedAt: data.startedAt || null,
            finishedAt: data.finishedAt || null,
            elapsedMilliseconds: data.elapsedMilliseconds || 0,
            status: data.status || ExecutionStatus.RUNNING
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => ExecutionSummary.freeze(item));

        return Object.freeze(value);

    }

}
