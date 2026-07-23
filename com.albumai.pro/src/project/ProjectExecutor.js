import ReplacementRequest from "../placement/ReplacementRequest";
import ProjectExecutionSummary, {
    ProjectExecutionStatus
} from "./ProjectExecutionSummary";
import AutoSaveResult, { AutoSaveStatus } from "../services/AutoSaveResult";
import ExportResult, { ExportStatus } from "../services/ExportResult";
import TemplateQueue from "./TemplateQueue";
import BatchExecutionService from "./BatchExecutionService";
import { BatchExecutionStatus } from "./BatchExecutionResult";
import Logger from "../core/photoshop/Logger";

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
        onProgress,
        templates = null,
        registeredTemplates = null,
        resolveTemplate = null,
        releaseTemplate = null,
        onStageProgress = null
    } = {}) {

        const queue = new TemplateQueue(templates || this.templates());
        const batch = await this.batchExecutionService.execute({
            queue,
            executeTemplate: async (descriptor, index, total) => {
                let template = null;
                let completed = false;
                const emitStage = stage => onStageProgress?.({ descriptor, index, total, stage });
                try {
                    emitStage("OPENING");
                    template = resolveTemplate ? await resolveTemplate(descriptor) : descriptor;
                    emitStage("VALIDATING");
                    const result = await this.executeTemplate({ project, photos, template, descriptor, autoSaveEnabled, autoSaveMode,
                        onAutoSaveResult, exportEnabled, exportFormat, onExportResult, onStageProgress: emitStage
                    });
                    completed = result.status === "COMPLETED";
                    return result;
                } catch (error) {
                    emitStage("FAILED");
                    Logger.warn(`END TEMPLATE: ${descriptor?.name || "PSD Template"} — FAILED`);
                    throw error;
                } finally {
                    emitStage("CLOSING");
                    if (typeof releaseTemplate === "function") await releaseTemplate(template, descriptor);
                    emitStage(completed ? "COMPLETED" : "FAILED");
                }
            },
            onProgress
        });

        return new ProjectExecutionSummary({
            projectId: this.projectId(project),
            totalTemplates: batch.totalTemplates,
            registeredTemplates: Number.isInteger(registeredTemplates)
                ? registeredTemplates
                : batch.totalTemplates,
            completedTemplates: batch.completedTemplates,
            successfulTemplates: batch.successfulTemplates,
            failedTemplates: batch.failedTemplates,
            templateResults: batch.templateResults,
            startedAt: batch.startedAt,
            finishedAt: batch.completedAt,
            elapsedMilliseconds: batch.durationMs,
            batchExecution: batch,
            batchProgress: {
                lifecycle: batch.status,
                stage: batch.status === BatchExecutionStatus.FAILED ? "FAILED" : "COMPLETED",
                currentTemplate: batch.currentTemplate,
                templateIndex: batch.templateIndex,
                totalTemplates: batch.totalTemplates,
                completedTemplates: batch.completedTemplates,
                successfulTemplates: batch.successfulTemplates,
                failedTemplates: batch.failedTemplates,
                remainingTemplates: Math.max(0, batch.totalTemplates - batch.completedTemplates),
                percentage: batch.totalTemplates ? Math.round((batch.completedTemplates / batch.totalTemplates) * 100) : 0
            },
            status: batch.status === BatchExecutionStatus.FAILED || batch.failedTemplates
                ? ProjectExecutionStatus.FAILED
                : ProjectExecutionStatus.COMPLETED
        });

    }

    async executeTemplate({ project, photos, template, descriptor = null, autoSaveEnabled, autoSaveMode, onAutoSaveResult, exportEnabled, exportFormat, onExportResult, onStageProgress }) {

        const context = this.documentContext(template, descriptor);
        Logger.info(`START TEMPLATE: ${context.documentName}`);
        Logger.info(`QUEUE DOCUMENT ID: ${context.documentId}`);
        this.templateRegistry.register(template);
        await this.activateContext(context, "EXECUTION");
        onStageProgress?.("PLANNING");
        const placementResult = this.photoPlacementEngine.plan({ project, photos, template });
        await this.activateContext(context, "EXECUTION PLAN");
        const executionPlan = this.placementExecutionPlanBuilder.build({ placementResult, project, template, photos });
        const request = new ReplacementRequest({ executionPlan });
        await this.activateContext(context, "REPLACEMENT");
        onStageProgress?.("REPLACING");
        const executionSummary = await this.replacementBatchExecutor.execute(request, { photos, templateName: template.name });
        await this.activateContext(context, "SAVE");
        onStageProgress?.("SAVING");
        const autoSaveResult = await this.autoSave({ project, template, descriptor, documentContext: context, executionSummary, enabled: autoSaveEnabled, mode: autoSaveMode });
        if (typeof onAutoSaveResult === "function") onAutoSaveResult(autoSaveResult);
        await this.activateContext(context, "EXPORT");
        onStageProgress?.("EXPORTING");
        const exportResult = await this.exportTemplate({ project, template, descriptor, documentContext: context, autoSaveResult, enabled: exportEnabled, format: exportFormat });
        if (typeof onExportResult === "function") onExportResult(exportResult);

        const failed = executionSummary.status !== "COMPLETED" ||
            autoSaveResult.status === AutoSaveStatus.FAILED ||
            exportResult.status === ExportStatus.FAILED;
        Logger.info(`END TEMPLATE: ${context.documentName} — ${failed ? "FAILED" : "COMPLETED"}`);

        const result = {
            status: failed ? "FAILED" : "COMPLETED",
            completedSteps: executionSummary.completedSteps,
            failedSteps: executionSummary.failedSteps,
            executionSummary,
            autoSaveResult,
            exportResult,
            documentContext: context,
            warnings: [...autoSaveResult.warnings, ...exportResult.warnings]
        };
        onStageProgress?.(failed ? "FAILED" : "COMPLETED");
        return result;

    }

    documentContext(template, descriptor) {
        const documentId = template?.document?.id ?? template?.id;
        if (documentId == null) throw new Error("Registered template did not open a Photoshop document.");
        return Object.freeze({
            descriptor,
            documentId,
            documentName: descriptor?.name || template?.name || "PSD Template",
            fileReference: descriptor?.fileReference || template?.filePath || ""
        });
    }

    async activateContext(context, stage) {
        const documentManager = this.replacementBatchExecutor.replacementStepExecutor.documentManager;
        const document = documentManager.byId(context.documentId);
        if (!document) throw new Error(`Template document is no longer open: ${context.documentName}.`);
        await documentManager.activate(document);
        const active = documentManager.active;
        Logger.info(`ACTIVE DOCUMENT BEFORE ${stage}: ${active?.id ?? "MISSING"}/${active?.title || "MISSING"}`);
        if (active?.id !== context.documentId) throw new Error(`Template document could not be activated: ${context.documentName}.`);
        return document;
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
