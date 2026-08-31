import ReplacementRequest from "../placement/ReplacementRequest";
import ProjectExecutionSummary, {
    ProjectExecutionStatus
} from "./ProjectExecutionSummary";
import AutoSaveResult, { AutoSaveStatus } from "../services/AutoSaveResult";
import ExportResult, { ExportStatus } from "../services/ExportResult";
import TemplateQueue from "./TemplateQueue";
import BatchExecutionService from "./BatchExecutionService";
import { BatchExecutionStatus } from "./BatchExecutionResult";
import {
    isTemplateOutputCompleteByDefault,
    snapshotTemplateOutputTransactions
} from "./OutputTransactionRecovery";
import Logger from "../core/photoshop/Logger";

/** Coordinates deterministic template execution through the batch executor. */
export default class ProjectExecutor {

    constructor({
        templateRegistry,
        photoPlacementEngine,
        placementExecutionPlanBuilder,
        replacementBatchExecutor,
        manualTypographyWorkflow = null,
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
        this.manualTypographyWorkflow = manualTypographyWorkflow;
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
        onStageProgress = null,
        photoCursor = 0,
        selectedPhotoIds = null
        ,cancellationController = null
        ,resumeState = null
        ,sheetContext = null
    } = {}) {

        const queue = new TemplateQueue(templates || this.templates());
        const selected = this.selectedPhotos(photos, selectedPhotoIds);

        if (selected.length === 0) {
            if (Array.isArray(selectedPhotoIds) && selectedPhotoIds.length > 0) {
                const error = new Error("Referenced photos for this sheet could not be found in the photo library.");
                error.code = "MISSING_REFERENCED_PHOTOS";
                throw error;
            }
            const error = new Error("Select at least one photo before processing.");
            error.code = "NO_SELECTED_PHOTOS";
            throw error;
        }

        const distribution = {
            selected,
            cursor: Math.max(0, Math.min(photoCursor, selected.length))
        };
        this.requireUniqueOutputBaseNames(
            queue,
            autoSaveEnabled || exportEnabled
        );
        const cancelled = stage => cancellationController?.isCancellationRequested()
            ? { status: "CANCELLED", cancelledAtStage: stage }
            : null;
        const batch = await this.batchExecutionService.execute({
            queue,
            executeTemplate: async (descriptor, index, total) => {
                let template = null;
                let completed = false;
                let isCancelledOutcome = false;
                let currentStage = "OPENING";
                const emitStage = stage => {
                    currentStage = stage;
                    const originalIndex = resumeState?.templateIndexes?.[descriptor?.id];
                    onStageProgress?.({
                        descriptor,
                        index: Number.isInteger(originalIndex)
                            ? originalIndex
                            : (Number(resumeState?.completedTemplates) || 0) + index,
                        total: Number(resumeState?.totalTemplates) || total,
                        stage
                    });
                };
                try {
                    if (distribution.cursor >= distribution.selected.length) {
                        return this.skippedNoPhotos(descriptor, distribution);
                    }
                    Logger.info(`BATCH_TEMPLATE_BEGIN: ${descriptor?.name || "PSD Template"} (${index + 1}/${total})`);
                    emitStage("OPENING");
                    template = resolveTemplate ? await resolveTemplate(descriptor) : descriptor;
                    Logger.info(`BATCH_OPEN_DONE: ${descriptor?.name || template?.name || "PSD Template"}`);
                    Logger.info(`OPEN_PSD_DONE: ${descriptor?.name || template?.name || "PSD Template"}`);
                    Logger.info(`SMART_OBJECTS_READY: ${template?.smartObjects?.length || 0}`);
                    emitStage("VALIDATING");
                    const afterOpen = cancelled("OPENING");
                    if (afterOpen) return afterOpen;
                    if (!template?.smartObjects?.some(slot => slot?.layerId != null)) {
                        completed = true;
                        return this.skippedNoPhotos(descriptor, distribution, "No Smart Object slots; skipped.");
                    }
                    const allocation = this.allocatePhotos(template, distribution);
                    const result = await this.executeTemplate({ project, photos: allocation.photos, template, descriptor, autoSaveEnabled, autoSaveMode,
                        onAutoSaveResult, exportEnabled, exportFormat, onExportResult, onStageProgress: emitStage, cancellationController, sheetContext
                    });
                    isCancelledOutcome = result?.status === "CANCELLED";
                    completed = result.status === "COMPLETED";
                    const outputTransactions = snapshotTemplateOutputTransactions(result);
                    const committedCancellation = isCancelledOutcome &&
                        isTemplateOutputCompleteByDefault({
                            status: result.status,
                            outputTransactions
                        });
                    const consumesPhotos = completed || committedCancellation;
                    const outcome = {
                        ...result,
                        photoAllocation: this.allocationSnapshot(
                            allocation,
                            completed
                                ? "COMPLETED"
                                : (committedCancellation
                                    ? "COMMITTED_AFTER_CANCEL"
                                    : (isCancelledOutcome ? "CANCELLED" : "FAILED"))
                        ),
                        warnings: [
                            ...(result.warnings || []),
                            ...(allocation.warning ? [allocation.warning] : [])
                        ]
                    };
                    if (consumesPhotos) {
                        distribution.cursor = allocation.endCursor;
                    } else if (isCancelledOutcome) {
                        outcome.warnings.push(
                            "Template cancelled; selected photos were not consumed."
                        );
                    } else {
                        outcome.warnings.push(
                            "Template failed; selected photos were not consumed."
                        );
                    }
                    return outcome;
                } catch (error) {
                    Logger.error(`TEMPLATE_EXECUTION_ERROR ${JSON.stringify({
                        errorName: error?.name || "Error",
                        errorMessage: error?.message || "Template execution failed.",
                        stack: error?.stack || null,
                        templateId: descriptor?.id ?? null,
                        templateName: descriptor?.name || template?.name || "PSD Template",
                        currentStage,
                        cancellationRequested: Boolean(cancellationController?.isCancellationRequested()),
                        cancellationToken: cancellationController?.getSnapshot?.() || null
                    })}`);
                    if (!isCancelledOutcome) {
                        emitStage("FAILED");
                        Logger.warn(`END TEMPLATE: ${descriptor?.name || "PSD Template"} — FAILED`);
                    }
                    throw error;
                } finally {
                    // Closing is required cleanup, but must not overwrite the
                    // user-visible cancellation boundary.
                    if (!isCancelledOutcome) emitStage("CLOSING");
                    if (typeof releaseTemplate === "function") {
                        await releaseTemplate(template, descriptor);
                    }
                    Logger.info(`BATCH_CLOSE_DONE: ${descriptor?.name || "PSD Template"}`);
                    Logger.info(`DOCUMENT_CLOSE_DONE: ${descriptor?.name || "PSD Template"}`);
                    if (!isCancelledOutcome) emitStage(completed ? "COMPLETED" : "FAILED");
                    const outcome = isCancelledOutcome ? "CANCELLED" : (completed ? "COMPLETED" : "FAILED");
                    Logger.info(`TEMPLATE_FINAL_OUTCOME: ${outcome}`);
                    Logger.info(`BATCH_TEMPLATE_COMPLETE: ${descriptor?.name || "PSD Template"} — ${outcome}`);
                }
            },
            onProgress,
            cancellationController,
            resumeState
        });

        Logger.info(`BATCH_QUEUE_COMPLETE: ${batch.completedTemplates}/${batch.totalTemplates} completed, ${batch.failedTemplates} failed`);

        return new ProjectExecutionSummary({
            projectId: this.projectId(project),
            totalTemplates: batch.totalTemplates,
            registeredTemplates: Number.isInteger(registeredTemplates)
                ? registeredTemplates
                : batch.totalTemplates,
            completedTemplates: batch.completedTemplates,
            successfulTemplates: batch.successfulTemplates,
            failedTemplates: batch.failedTemplates,
            skippedTemplates: batch.skippedTemplates,
            templateResults: batch.templateResults,
            startedAt: batch.startedAt,
            finishedAt: batch.completedAt,
            elapsedMilliseconds: batch.durationMs,
            batchExecution: batch,
            batchProgress: {
                lifecycle: batch.status,
                stage: batch.status === BatchExecutionStatus.FAILED
                    ? "FAILED"
                    : (batch.status === BatchExecutionStatus.CANCELLED
                        ? (batch.cancelledAtStage || "IDLE")
                        : "COMPLETED"),
                currentTemplate: batch.currentTemplate,
                templateIndex: batch.templateIndex,
                totalTemplates: batch.totalTemplates,
                completedTemplates: batch.completedTemplates,
                successfulTemplates: batch.successfulTemplates,
                failedTemplates: batch.failedTemplates,
                skippedTemplates: batch.skippedTemplates,
                remainingTemplates: Math.max(0, batch.totalTemplates - batch.completedTemplates),
                percentage: batch.totalTemplates ? Math.round((batch.completedTemplates / batch.totalTemplates) * 100) : 0
                ,retainedProgressPercent: batch.retainedProgressPercent || 0
            },
            status: batch.status === BatchExecutionStatus.FAILED || batch.failedTemplates
                ? ProjectExecutionStatus.FAILED
                : (batch.status === BatchExecutionStatus.CANCELLED
                    ? ProjectExecutionStatus.CANCELLED
                    : ProjectExecutionStatus.COMPLETED)
        });

    }

    async executeTemplate({ project, photos, template, descriptor = null, autoSaveEnabled, autoSaveMode, onAutoSaveResult, exportEnabled, exportFormat, onExportResult, onStageProgress, cancellationController = null, sheetContext = null }) {

        const context = this.documentContext(template, descriptor);
        Logger.info(`START TEMPLATE: ${context.documentName}`);
        Logger.info(`QUEUE DOCUMENT ID: ${context.documentId}`);
        this.templateRegistry.register(template);
        await this.activateContext(context, "EXECUTION");
        onStageProgress?.("PLANNING");
        const slotAssignments = Array.isArray(sheetContext?.slots)
            ? sheetContext.slots
            : [];
        const placementResult = this.photoPlacementEngine.plan({
            project,
            photos,
            template,
            options: slotAssignments.length
                ? { slotAssignments, allowReuse: true }
                : {}
        });
        Logger.info(`TEMPLATE_ASSIGNMENT_COUNT: ${placementResult.assignments?.length || 0}`);
        this.requireReplacementPlan(placementResult, null, null, context);
        await this.activateContext(context, "EXECUTION PLAN");
        const executionPlan = this.placementExecutionPlanBuilder.build({ placementResult, project, template, photos });
        Logger.info(`TEMPLATE_PLAN_STEP_COUNT: ${executionPlan.steps?.length || 0}`);
        this.requireReplacementPlan(placementResult, executionPlan, null, context);
        const request = new ReplacementRequest({ executionPlan });
        Logger.info(`TEMPLATE_REQUEST_STEP_COUNT: ${request.steps?.length || 0}`);
        this.requireReplacementPlan(placementResult, executionPlan, request, context);
        if (cancellationController?.isCancellationRequested()) return { status: "CANCELLED", cancelledAtStage: "PLANNING" };
        await this.activateContext(context, "REPLACEMENT");
        onStageProgress?.("REPLACING");
        const executionSummary = await this.replacementBatchExecutor.execute(request, { photos, templateName: template.name });
        Logger.info(`BATCH_REPLACE_DONE: ${context.documentName}`);
        Logger.info(`REPLACEMENT_DONE: ${context.documentName}`);
        Logger.info(`TEMPLATE_REPLACEMENT_STATUS: ${executionSummary.status}`);
        Logger.info(`TEMPLATE_REPLACEMENT_COMPLETED: ${executionSummary.status === "COMPLETED"}`);

        if (cancellationController?.isCancellationRequested()) {
            return {
                status: "CANCELLED",
                cancelledAtStage: "REPLACING",
                executionSummary,
                placementResult,
                executionPlan,
                replacementRequest: request
            };
        }

        const typographyAssignments = Array.isArray(sheetContext?.typographyAssignments)
            ? sheetContext.typographyAssignments
            : [];
        let typographyResult = null;
        if (typographyAssignments.length > 0) {
            if (!this.manualTypographyWorkflow) {
                throw new Error("Typography workflow is unavailable for this album sheet.");
            }
            await this.activateContext(context, "TYPOGRAPHY");
            onStageProgress?.("TYPOGRAPHY");
            typographyResult = await this.manualTypographyWorkflow.execute({
                template,
                expectedDocumentId: context.documentId,
                assignments: typographyAssignments
            });
            if (typographyResult?.status !== "SUCCESS") {
                const error = new Error(`Album Sheet typography failed: ${typographyResult?.reasonCode || "UNKNOWN"}`);
                error.code = "ALBUM_SHEET_TYPOGRAPHY_FAILED";
                throw error;
            }
        }

        if (cancellationController?.isCancellationRequested()) {
            return {
                status: "CANCELLED",
                cancelledAtStage: "TYPOGRAPHY",
                executionSummary,
                placementResult,
                executionPlan,
                replacementRequest: request,
                typographyResult
            };
        }

        // For ALBUM_SHEET_RENDER, derive a unique output base name from the sheet context.
        // This prevents all spreads that share the same PSD template from producing the
        // same output filename (e.g. 22.jpg colliding across 16 spreads).
        const outputBaseName = sheetContext != null
            ? ProjectExecutor.sheetOutputBaseName(sheetContext)
            : null;

        await this.activateContext(context, "SAVE");
        onStageProgress?.("SAVING");
        const autoSaveResult = await this.autoSave({ project, template, descriptor, documentContext: context, executionSummary, enabled: autoSaveEnabled, mode: autoSaveMode, cancellationController, outputBaseName });
        Logger.info(`BATCH_AUTOSAVE_DONE: ${context.documentName} — ${autoSaveResult.status}`);
        Logger.info(`AUTOSAVE_DONE: ${context.documentName} — ${autoSaveResult.status}`);
        Logger.info(`TEMPLATE_AUTOSAVE_STATUS: ${autoSaveResult.status}`);
        if (typeof onAutoSaveResult === "function") onAutoSaveResult(autoSaveResult);
        if (cancellationController?.isCancellationRequested()) return { status: "CANCELLED", cancelledAtStage: "SAVING", executionSummary, placementResult, executionPlan, replacementRequest: request, autoSaveResult };
        await this.activateContext(context, "EXPORT");
        onStageProgress?.("EXPORTING");
        const exportResult = await this.exportTemplate({ project, template, descriptor, documentContext: context, autoSaveResult, enabled: exportEnabled, format: exportFormat, cancellationController, outputBaseName });
        Logger.info(`BATCH_EXPORT_DONE: ${context.documentName} — ${exportResult.status}`);
        Logger.info(`EXPORT_DONE: ${context.documentName} — ${exportResult.status}`);
        Logger.info(`TEMPLATE_EXPORT_STATUS: ${exportResult.status}`);
        if (typeof onExportResult === "function") onExportResult(exportResult);
        if (cancellationController?.isCancellationRequested()) return { status: "CANCELLED", cancelledAtStage: "EXPORTING", executionSummary, placementResult, executionPlan, replacementRequest: request, autoSaveResult, exportResult };

        const succeeded = this.isTemplateSuccessful({
            placementResult,
            executionPlan,
            request,
            executionSummary,
            typographyResult,
            autoSaveResult,
            exportResult,
            autoSaveEnabled,
            exportEnabled
        });
        const failed = !succeeded;
        Logger.info(`END TEMPLATE: ${context.documentName} — ${failed ? "FAILED" : "COMPLETED"}`);

        const result = {
            status: failed ? "FAILED" : "COMPLETED",
            completedSteps: executionSummary.completedSteps,
            failedSteps: executionSummary.failedSteps,
            executionSummary,
            placementResult,
            executionPlan,
            replacementRequest: request,
            templateContext: this.templateSnapshot(template, context),
            autoSaveResult,
            exportResult,
            documentContext: context,
            warnings: [...autoSaveResult.warnings, ...exportResult.warnings]
        };
        onStageProgress?.(failed ? "FAILED" : "COMPLETED");
        return result;

    }

    requireReplacementPlan(
        placementResult,
        executionPlan,
        request,
        context
    ) {

        const placementCount = Array.isArray(placementResult?.assignments)
            ? placementResult.assignments.length
            : 0;
        const planCount = executionPlan == null
            ? null
            : (Array.isArray(executionPlan.steps)
                ? executionPlan.steps.length
                : 0);
        const requestCount = request == null
            ? null
            : (Array.isArray(request.steps)
                ? request.steps.length
                : 0);

        if (
            placementCount > 0 &&
            (planCount == null || planCount > 0) &&
            (requestCount == null || requestCount > 0)
        ) {
            Logger.info(`TEMPLATE_PLAN_STATUS: READY — assignments=${placementCount}, plan=${planCount ?? "pending"}, request=${requestCount ?? "pending"}`);
            return;
        }

        const error = "No valid replacement plan was created.";
        Logger.error(`TEMPLATE_PLAN_STATUS: FAILED — ${error}`);
        Logger.warn("TEMPLATE_REPLACEMENT_STATUS: SKIPPED");
        Logger.warn("TEMPLATE_AUTOSAVE_STATUS: SKIPPED");
        Logger.warn("TEMPLATE_EXPORT_STATUS: SKIPPED");
        throw new Error(error);

    }

    isTemplateSuccessful({
        placementResult,
        executionPlan,
        request,
        executionSummary,
        autoSaveResult,
        exportResult,
        autoSaveEnabled,
        exportEnabled
    }) {

        const hasPlacement = Array.isArray(placementResult?.assignments) &&
            placementResult.assignments.length > 0;
        const hasExecutionPlan = Array.isArray(executionPlan?.steps) &&
            executionPlan.steps.length > 0;
        const hasRequest = Array.isArray(request?.steps) &&
            request.steps.length > 0;
        const replacementSucceeded = executionSummary?.status === "COMPLETED" &&
            executionSummary.completedSteps === request.steps.length &&
            executionSummary.failedSteps === 0;
        const autoSaveFailed = autoSaveEnabled &&
            autoSaveResult?.status === AutoSaveStatus.FAILED;
        const exportFailed = exportEnabled &&
            exportResult?.status === ExportStatus.FAILED;

        return hasPlacement &&
            hasExecutionPlan &&
            hasRequest &&
            replacementSucceeded &&
            !autoSaveFailed &&
            !exportFailed;

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

    templateSnapshot(template, context) {

        return Object.freeze({
            id: template?.id ?? null,
            documentId: context?.documentId ?? null,
            name: context?.documentName || template?.name || "PSD Template",
            smartObjects: (template?.smartObjects || []).map(slot => ({
                layerId: slot?.layerId ?? null,
                layerName: slot?.layerName || ""
            }))
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

    selectedPhotos(photos, selectedPhotoIds) {

        const source = Array.isArray(photos) ? photos : [];
        if (Array.isArray(selectedPhotoIds) && selectedPhotoIds.length) {
            const byId = new Map(source.map(photo => [photo?.id, photo]));
            return selectedPhotoIds.map(id => byId.get(id)).filter(Boolean);
        }
        return source.filter(photo => photo?.selected);

    }

    allocatePhotos(template, distribution) {

        const slots = Array.isArray(template?.smartObjects)
            ? template.smartObjects.filter(slot => slot?.layerId != null)
            : [];
        const startCursor = distribution.cursor;
        const photos = distribution.selected.slice(
            startCursor,
            startCursor + slots.length
        );
        const warning = photos.length < slots.length
            ? `Only ${photos.length} selected photos remain for ${slots.length} Smart Object slots.`
            : null;
        return {
            startCursor,
            endCursor: startCursor + photos.length,
            remainingPhotos: Math.max(0, distribution.selected.length - startCursor - photos.length),
            photos,
            warning
        };

    }

    allocationSnapshot(allocation, status) {

        return {
            startCursor: allocation.startCursor,
            endCursor: allocation.endCursor,
            assignedCount: allocation.photos.length,
            assignedPhotoIds: allocation.photos.map(photo => photo?.id),
            remainingCount: allocation.remainingPhotos,
            status
        };

    }

    skippedNoPhotos(descriptor, distribution, warning = "No photos remain; template not opened.") {

        return {
            status: "SKIPPED_NO_PHOTOS",
            error: null,
            warnings: [warning],
            photoAllocation: {
                startCursor: distribution.cursor,
                endCursor: distribution.cursor,
                assignedCount: 0,
                assignedPhotoIds: [],
                remainingCount: 0,
                status: "SKIPPED_NO_PHOTOS"
            }
        };

    }

    requireUniqueOutputBaseNames(queue, outputsEnabled) {

        if (!outputsEnabled) return;

        const owners = new Map();
        for (let index = 0; index < queue.total; index += 1) {
            const descriptor = queue.descriptorAt(index);
            const baseName = String(
                descriptor?.name || descriptor?.fileName || "template"
            ).replace(/\.[^.]+$/, "").toLocaleLowerCase();
            if (owners.has(baseName)) {
                throw new Error(
                    `Registered templates share the output filename "${descriptor?.name || "template"}". Rename one template before processing.`
                );
            }
            owners.set(baseName, descriptor?.id || index);
        }

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

    /**
     * Derives a deterministic, zero-padded output base name for an album sheet.
     *
     * Convention: Spread_01, Spread_02 … Spread_16
     * Uses the 1-based sheetOrder (0-indexed sheetOrder + 1), padded to 2 digits.
     * The template PSD filename is intentionally excluded from the output name
     * so that multiple spreads rendered from the same template do not collide.
     *
     * @param {{ sheetId: string, sheetLabel: string, sheetOrder: number }} sheetContext
     * @returns {string}
     */
    static sheetOutputBaseName({ sheetOrder = 0, sheetLabel = "" } = {}) {
        const n = String(sheetOrder + 1).padStart(2, "0");
        return `Spread_${n}`;
    }

}
