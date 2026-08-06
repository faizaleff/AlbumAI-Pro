import BatchExecutionResult, { BatchExecutionStatus } from "./BatchExecutionResult";
import {
    snapshotTemplateOutputTransactions,
    templateOutputRetryDisposition
} from "./OutputTransactionRecovery";

/** Runs supplied single-template work sequentially without owning its implementation. */
export default class BatchExecutionService {

    constructor() {

        this.inFlight = null;

    }

    async execute({ queue, executeTemplate, onProgress, cancellationController = null, resumeState = null } = {}) {

        if (this.inFlight) throw new Error("A template batch is already running.");
        if (!queue || typeof queue.total !== "number") throw new Error("A template queue is required.");
        if (typeof executeTemplate !== "function") throw new Error("A single-template execution callback is required.");

        this.inFlight = this.run({ queue, executeTemplate, onProgress, cancellationController, resumeState });
        try {
            return await this.inFlight;
        } finally {
            this.inFlight = null;
        }

    }

    async run({ queue, executeTemplate, onProgress, cancellationController, resumeState }) {

        const startedAt = new Date().toISOString();
        const startedMs = Date.now();
        const templateResults = [];
        const totalTemplates = Math.max(queue.total, Number(resumeState?.totalTemplates) || 0);
        const resumeOffset = Number(resumeState?.completedTemplates) || 0;
        const originalIndex = template => resumeState?.templateIndexes?.[template?.id];
        let successfulTemplates = Number(resumeState?.successfulTemplates) || 0;
        let failedTemplates = Number(resumeState?.failedTemplates) || 0;
        let skippedTemplates = Number(resumeState?.skippedTemplates) || 0;
        const accountOutcome = (template, outcome) => {
            if (outcome === "COMPLETED") successfulTemplates += 1;
            else if (outcome === "SKIPPED_NO_PHOTOS") skippedTemplates += 1;
            else if (outcome === "FAILED") failedTemplates += 1;
            console.info("BATCH_OUTCOME_ACCOUNTING", JSON.stringify({
                templateId: template?.id ?? null,
                outcome,
                completed: successfulTemplates + failedTemplates + skippedTemplates,
                successful: successfulTemplates,
                failed: failedTemplates,
                skipped: skippedTemplates
            }));
        };
        const emit = (status, currentIndex = -1, fatalError = null, cancellation = null) => {
            const completedTemplates = successfulTemplates + failedTemplates + skippedTemplates;
            const result = new BatchExecutionResult({
                status,
                totalTemplates,
                completedTemplates,
                successfulTemplates,
                failedTemplates,
                skippedTemplates,
                startedAt,
                completedAt: status === BatchExecutionStatus.RUNNING ? null : new Date().toISOString(),
                durationMs: Date.now() - startedMs,
                templateResults: templateResults.slice(),
                warnings: templateResults.flatMap(item => item.warnings || []),
                fatalError,
                currentTemplate: queue.descriptorAt(currentIndex),
                templateIndex: currentIndex >= 0
                    ? (Number.isInteger(originalIndex(queue.descriptorAt(currentIndex)))
                        ? originalIndex(queue.descriptorAt(currentIndex))
                        : resumeOffset + currentIndex)
                    : null,
                pendingTemplates: Math.max(0, totalTemplates - completedTemplates),
                cancelReason: cancellation?.reason || null,
                cancelledAtTemplateId: queue.descriptorAt(currentIndex)?.id || null,
                cancelledAtStage: cancellation?.stage || null,
                retainedProgressPercent: cancellation?.retainedProgressPercent || 0
            });
            if (typeof onProgress === "function") onProgress(result);
            return result;
        };

        try {
            emit(BatchExecutionStatus.RUNNING);
            for (let index = 0; index < queue.total; index += 1) {
                const template = queue.descriptorAt(index);
                if (cancellationController?.isCancellationRequested()) {
                    cancellationController.markEffective();
                    const cancellation = { ...cancellationController.getSnapshot(), stage: "OPENING" };
                    console.info("BATCH_CANCEL_BOUNDARY_REACHED", JSON.stringify(cancellation));
                    console.info("BATCH_CANCELLING", JSON.stringify(cancellation));
                    emit(BatchExecutionStatus.CANCELLING, index, null, cancellation);
                    const cancelled = emit(BatchExecutionStatus.CANCELLED, index, null, cancellation);
                    console.info("BATCH_CANCELLED", JSON.stringify(cancellation));
                    return cancelled;
                }
                const running = this.templateResult(template, "RUNNING", { startedAt: new Date().toISOString() });
                templateResults.push(running);
                emit(BatchExecutionStatus.RUNNING, index);

                try {
                    const result = await executeTemplate(template, index, queue.total);
                    if (result?.status === "CANCELLED") {
                        templateResults.splice(index, 1, this.templateResult(template, "CANCELLED", { ...result, startedAt: running.startedAt }));
                        cancellationController?.markEffective();
                        const cancellation = { ...cancellationController?.getSnapshot(), stage: result.cancelledAtStage || "SAFE_BOUNDARY" };
                        console.info("BATCH_CANCEL_BOUNDARY_REACHED", JSON.stringify(cancellation));
                        console.info("BATCH_CANCELLING", JSON.stringify(cancellation));
                        emit(BatchExecutionStatus.CANCELLING, index, null, cancellation);
                        const cancelled = emit(BatchExecutionStatus.CANCELLED, index, null, cancellation);
                        console.info("BATCH_CANCELLED", JSON.stringify(cancellation));
                        return cancelled;
                    }
                    // Callback completion is not proof of a usable template
                    // result. Only the explicit terminal success status counts.
                    const outcome = result?.status === "COMPLETED"
                        ? "COMPLETED"
                        : (result?.status === "SKIPPED_NO_PHOTOS" ? "SKIPPED_NO_PHOTOS" : "FAILED");
                    const failed = outcome === "FAILED";
                    templateResults.splice(index, 1, this.templateResult(template, outcome, {
                        ...result,
                        error: failed
                            ? result?.error || "Template execution did not report successful replacement."
                            : null,
                        startedAt: running.startedAt
                    }));
                    accountOutcome(template, outcome);
                } catch (error) {
                    templateResults.splice(index, 1, this.templateResult(template, "FAILED", {
                        error: error?.message || "Template execution failed.",
                        startedAt: running.startedAt
                    }));
                    accountOutcome(template, "FAILED");
                }

                emit(BatchExecutionStatus.RUNNING, index);
            }

            return emit(failedTemplates ? BatchExecutionStatus.COMPLETED_WITH_ERRORS : BatchExecutionStatus.COMPLETED);
        } catch (error) {
            return emit(BatchExecutionStatus.FAILED, -1, error?.message || "Batch execution failed.");
        }

    }

    templateResult(template, status, data = {}) {

        const startedAt = data.startedAt || null;
        const completedAt = status === "RUNNING" ? null : new Date().toISOString();
        const outputTransactions = snapshotTemplateOutputTransactions(data);
        return BatchExecutionResult.freeze({
            templateId: template?.id ?? null,
            templatePath: template?.filePath || "",
            templateName: template?.name || "",
            status,
            completedSteps: data.completedSteps || data.executionSummary?.completedSteps || 0,
            failedSteps: data.failedSteps || data.executionSummary?.failedSteps || 0,
            autosaveResult: data.autoSaveResult || null,
            exportResult: data.exportResult || null,
            outputTransactions,
            outputRetryDisposition: templateOutputRetryDisposition({ status, outputTransactions }),
            warnings: data.warnings || [],
            error: data.error || null,
            executionSummary: data.executionSummary || null,
            placementResult: data.placementResult || null,
            executionPlan: data.executionPlan || null,
            replacementRequest: data.replacementRequest || null,
            photoAllocation: data.photoAllocation || null,
            templateContext: data.templateContext || null,
            documentContext: data.documentContext || null,
            startedAt,
            completedAt,
            durationMs: startedAt && completedAt ? Date.parse(completedAt) - Date.parse(startedAt) : 0
        });

    }

}
