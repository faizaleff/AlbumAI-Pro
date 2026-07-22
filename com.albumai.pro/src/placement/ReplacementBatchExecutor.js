import ExecutionSummary, { ExecutionStatus } from "./ExecutionSummary";
import ReplacementResult from "./ReplacementResult";
import BatchProgress, { BatchProgressStatus } from "./BatchProgress";

export default class ReplacementBatchExecutor {

    constructor({ replacementStepExecutor } = {}) {

        if (!replacementStepExecutor) {
            throw new Error("A replacement step executor is required.");
        }

        this.replacementStepExecutor = replacementStepExecutor;

    }

    async execute(request, {
        photos = [],
        templateName = "",
        onProgress
    } = {}) {

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

        this.publishProgress(onProgress, {
            currentStep: 0,
            totalSteps: request.steps.length,
            completedSteps,
            successCount: completedSteps,
            failedCount: failedSteps,
            currentTemplateId: request.templateId,
            currentTemplateName: templateName,
            percentComplete: 0,
            status: BatchProgressStatus.RUNNING
        });

        for (const [index, step] of request.steps.entries()) {
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

            this.publishProgress(onProgress, {
                currentStep: index + 1,
                totalSteps: request.steps.length,
                completedSteps: index + 1,
                successCount: completedSteps,
                failedCount: failedSteps,
                currentPhotoId: step.photoId,
                currentPhotoName: step.photoName,
                currentSlotLayerId: step.slotLayerId,
                currentSlotName: step.slotName,
                currentTemplateId: request.templateId,
                currentTemplateName: templateName,
                percentComplete: this.percentComplete(index + 1, request.steps.length),
                status: BatchProgressStatus.RUNNING
            });
        }

        this.publishProgress(onProgress, {
            currentStep: request.steps.length,
            totalSteps: request.steps.length,
            completedSteps: request.steps.length,
            successCount: completedSteps,
            failedCount: failedSteps,
            currentPhotoId: request.steps[request.steps.length - 1].photoId,
            currentPhotoName: request.steps[request.steps.length - 1].photoName,
            currentSlotLayerId: request.steps[request.steps.length - 1].slotLayerId,
            currentSlotName: request.steps[request.steps.length - 1].slotName,
            currentTemplateId: request.templateId,
            currentTemplateName: templateName,
            percentComplete: 100,
            status: BatchProgressStatus.COMPLETED
        });

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

    publishProgress(onProgress, data) {

        if (typeof onProgress === "function") {
            onProgress(new BatchProgress(data));
        }

    }

    percentComplete(completedSteps, totalSteps) {

        return totalSteps
            ? Math.round((completedSteps / totalSteps) * 10000) / 100
            : 0;

    }

}
