import ExecutionSummary, { ExecutionStatus } from "./ExecutionSummary";
import ReplacementResult from "./ReplacementResult";

export default class ReplacementBatchExecutor {

    constructor({ replacementStepExecutor } = {}) {

        if (!replacementStepExecutor) {
            throw new Error("A replacement step executor is required.");
        }

        this.replacementStepExecutor = replacementStepExecutor;

    }

    async execute(request, { photos = [] } = {}) {

        const startedAt = new Date().toISOString();
        const startedMilliseconds = Date.now();

        if (!request || !Array.isArray(request.steps) || !request.steps.length) {
            return this.failureSummary({
                requestId: request?.id ?? null,
                totalSteps: Array.isArray(request?.steps) ? request.steps.length : 0,
                message: "A replacement request with at least one step is required.",
                startedAt,
                startedMilliseconds
            });
        }

        const results = [];
        let completedSteps = 0;
        let failedSteps = 0;

        for (const step of request.steps) {
            let result;

            try {
                result = await this.replacementStepExecutor.execute({
                    ...step,
                    requestId: request.id
                }, photos);
            }
            catch (error) {
                result = new ReplacementResult({
                    requestId: request.id,
                    status: "FAILED",
                    failedSteps: [{
                        stepNumber: step?.stepNumber ?? null,
                        slotLayerId: step?.slotLayerId ?? null,
                        message: error.message
                    }],
                    errors: [error.message],
                    startedAt,
                    finishedAt: new Date().toISOString()
                });
            }

            results.push(result);

            if (result.status === "SUCCESS") {
                completedSteps += 1;
            }
            else {
                failedSteps += 1;
            }
        }

        return new ExecutionSummary({
            requestId: request.id,
            totalSteps: request.steps.length,
            completedSteps,
            failedSteps,
            skippedSteps: 0,
            results,
            startedAt,
            finishedAt: new Date().toISOString(),
            elapsedMilliseconds: Date.now() - startedMilliseconds,
            status: failedSteps ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED
        });

    }

    failureSummary({ requestId, totalSteps, message, startedAt, startedMilliseconds }) {

        const finishedAt = new Date().toISOString();

        return new ExecutionSummary({
            requestId,
            totalSteps,
            completedSteps: 0,
            failedSteps: 0,
            skippedSteps: totalSteps,
            results: [],
            startedAt,
            finishedAt,
            elapsedMilliseconds: Date.now() - startedMilliseconds,
            status: ExecutionStatus.FAILED,
            errors: [message]
        });

    }

}
