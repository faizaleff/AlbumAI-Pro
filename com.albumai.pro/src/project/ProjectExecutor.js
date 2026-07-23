import ReplacementRequest from "../placement/ReplacementRequest";
import ProjectExecutionSummary, {
    ProjectExecutionStatus
} from "./ProjectExecutionSummary";
import AutoSaveResult, { AutoSaveStatus } from "../services/AutoSaveResult";
import ExportResult, { ExportStatus } from "../services/ExportResult";
import TemplateQueue from "./TemplateQueue";
import BatchExecutionService from "./BatchExecutionService";
import { BatchExecutionStatus } from "./BatchExecutionResult";

/** Coordinates deterministic template execution through the batch executor. */
export default class ProjectExecutor {

    constructor({
        templateRegistry,
        photoPlacementEngine,
        placementExecutionPlanBuilder,
        replacementBatchExecutor,
        templateAutoSaveService,
        templateExportService,
        batchExecutionService = new BatchExecutionService()
    } = {}) {

        if (!templateRegistry) throw new Error("A template registry is required.");
        if (!photoPlacementEngine) throw new Error("A photo placement engine is required.");
        if (!placementExecutionPlanBuilder) throw new Error("A placement execution plan builder is required.");
        if (!replacementBatchExecutor) throw new Error("A replacement batch executor is required.");

        this.templateRegistry = templateRegistry;
        this.photoPlacementEngine = photoPlacementEngine;
        this.placementExecutionPlanBuilder = placementExecutionPlanBuilder;
        this.replacementBatchExecutor = replacementBatchExecutor;
        this.templateAutoSaveService = templateAutoSaveService;
        this.templateExportService = templateExportService;
        this.batchExecutionService = batchExecutionService;

    }

    async execute({
        project,
        photos = [],
        autoSaveEnabled = false,
        autoSaveMode = "SAVE_COPY",
        onAutoSaveResult,
        exportEnabled = false,
        exportFormat = "JPEG",
        onExportResult,
        onProgress
    } = {}) {

        const queue = new TemplateQueue(this.templates());
        const batch = await this.batchExecutionService.execute({
            queue,
            executeTemplate: template => this.executeTemplate({
                project, photos, template, autoSaveEnabled, autoSaveMode,
                onAutoSaveResult, exportEnabled, exportFormat, onExportResult
            }),
            onProgress
        });

        return new ProjectExecutionSummary({
            projectId: this.projectId(project),
            totalTemplates: batch.totalTemplates,
            completedTemplates: batch.completedTemplates,
            successfulTemplates: batch.successfulTemplates,
            failedTemplates: batch.failedTemplates,
            templateResults: batch.templateResults,
            startedAt: batch.startedAt,
            finishedAt: batch.completedAt,
            elapsedMilliseconds: batch.durationMs,
            batchExecution: batch,
            status: batch.status === BatchExecutionStatus.FAILED || batch.failedTemplates
                ? ProjectExecutionStatus.FAILED
                : ProjectExecutionStatus.COMPLETED
        });

    }

    async executeTemplate({ project, photos, template, autoSaveEnabled, autoSaveMode, onAutoSaveResult, exportEnabled, exportFormat, onExportResult }) {

        this.templateRegistry.register(template);
        const placementResult = this.photoPlacementEngine.plan({ project, photos, template });
        const executionPlan = this.placementExecutionPlanBuilder.build({ placementResult, project, template, photos });
        const request = new ReplacementRequest({ executionPlan });
        const executionSummary = await this.replacementBatchExecutor.execute(request, { photos, templateName: template.name });
        const autoSaveResult = await this.autoSave({ project, template, executionSummary, enabled: autoSaveEnabled, mode: autoSaveMode });
        if (typeof onAutoSaveResult === "function") onAutoSaveResult(autoSaveResult);
        const exportResult = await this.exportTemplate({ project, template, autoSaveResult, enabled: exportEnabled, format: exportFormat });
        if (typeof onExportResult === "function") onExportResult(exportResult);

        return {
            status: executionSummary.status === "COMPLETED" ? "COMPLETED" : "FAILED",
            completedSteps: executionSummary.completedSteps,
            failedSteps: executionSummary.failedSteps,
            executionSummary,
            autoSaveResult,
            exportResult,
            warnings: [...autoSaveResult.warnings, ...exportResult.warnings]
        };

    }

    templates() {

        return this.templateRegistry.getAll()
            .map((template, registryOrder) => ({ template, registryOrder }))
            .sort((left, right) => {
                if (left.registryOrder !== right.registryOrder) {
                    return left.registryOrder - right.registryOrder;
                }

                const timestampDifference = this.registrationTimestamp(left.template) -
                    this.registrationTimestamp(right.template);

                if (timestampDifference) return timestampDifference;

                return String(left.template?.id).localeCompare(
                    String(right.template?.id),
                    undefined,
                    { numeric: true, sensitivity: "base" }
                );
            })
            .map(item => item.template);

    }

    registrationTimestamp(template) {

        const timestamp = Date.parse(template?.registeredAt || "");

        return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;

    }

    projectId(project) {

        return project?.metadata?.id ?? project?.metadata?.name ?? null;

    }

    async autoSave(options) {

        if (!this.templateAutoSaveService) {
            return new AutoSaveResult({
                templateId: options.template?.id ?? null,
                documentId: options.template?.document?.id ?? null,
                mode: options.mode,
                status: AutoSaveStatus.SKIPPED,
                warnings: ["Auto Save is unavailable."]
            });
        }

        return this.templateAutoSaveService.save(options);

    }

    async exportTemplate(options) {

        if (!this.templateExportService) {
            return new ExportResult({
                templateId: options.template?.id ?? null,
                documentId: options.template?.document?.id ?? null,
                format: options.format,
                status: ExportStatus.SKIPPED,
                warnings: ["Export is unavailable."]
            });
        }

        return this.templateExportService.export(options);

    }

}
