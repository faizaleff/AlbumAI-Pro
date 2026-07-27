import BatchExecutionResult, { BatchExecutionStatus } from "./BatchExecutionResult";

/** Runs supplied single-template work sequentially without owning its implementation. */
export default class BatchExecutionService {

    constructor() {

        this.inFlight = null;

    }

    async execute({ queue, executeTemplate, onProgress } = {}) {

        if (this.inFlight) throw new Error("A template batch is already running.");
        if (!queue || typeof queue.total !== "number") throw new Error("A template queue is required.");
        if (typeof executeTemplate !== "function") throw new Error("A single-template execution callback is required.");

        this.inFlight = this.run({ queue, executeTemplate, onProgress });
        try {
            return await this.inFlight;
        } finally {
            this.inFlight = null;
        }

    }

    async run({ queue, executeTemplate, onProgress }) {

        const startedAt = new Date().toISOString();
        const startedMs = Date.now();
        const templateResults = [];
        let successfulTemplates = 0;
        let failedTemplates = 0;
        let skippedTemplates = 0;
        const emit = (status, currentIndex = -1, fatalError = null) => {
            const completedTemplates = successfulTemplates + failedTemplates + skippedTemplates;
            const result = new BatchExecutionResult({
                status,
                totalTemplates: queue.total,
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
                templateIndex: currentIndex >= 0 ? currentIndex : null
            });
            if (typeof onProgress === "function") onProgress(result);
            return result;
        };

        try {
            emit(BatchExecutionStatus.RUNNING);
            for (let index = 0; index < queue.total; index += 1) {
                const template = queue.descriptorAt(index);
                const running = this.templateResult(template, "RUNNING", { startedAt: new Date().toISOString() });
                templateResults.push(running);
                emit(BatchExecutionStatus.RUNNING, index);

                try {
                    const result = await executeTemplate(template, index, queue.total);
                    // Callback completion is not proof of a usable template
                    // result. Only the explicit terminal success status counts.
                    const succeeded = result?.status === "COMPLETED";
                    const skipped = result?.status === "SKIPPED_NO_PHOTOS";
                    const failed = !succeeded && !skipped;
                    templateResults.splice(index, 1, this.templateResult(template, skipped ? "SKIPPED_NO_PHOTOS" : (failed ? "FAILED" : "COMPLETED"), {
                        ...result,
                        error: failed
                            ? result?.error || "Template execution did not report successful replacement."
                            : null,
                        startedAt: running.startedAt
                    }));
                    if (failed) failedTemplates += 1;
                    else if (succeeded) successfulTemplates += 1;
                    else if (skipped) skippedTemplates += 1;
                } catch (error) {
                    failedTemplates += 1;
                    templateResults.splice(index, 1, this.templateResult(template, "FAILED", {
                        error: error?.message || "Template execution failed.",
                        startedAt: running.startedAt
                    }));
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
        return BatchExecutionResult.freeze({
            templateId: template?.id ?? null,
            templatePath: template?.filePath || "",
            templateName: template?.name || "",
            status,
            completedSteps: data.completedSteps || data.executionSummary?.completedSteps || 0,
            failedSteps: data.failedSteps || data.executionSummary?.failedSteps || 0,
            autosaveResult: data.autoSaveResult || null,
            exportResult: data.exportResult || null,
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
