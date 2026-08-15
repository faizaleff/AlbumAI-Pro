import LibraryEngine from "../core/LibraryEngine";
import SelectionEngine from "../core/SelectionEngine";
import ProjectEngine from "../core/ProjectEngine";
import ProjectService from "../services/ProjectService";
import PhotoWorkspaceService, {
    PhotoFolderChangeStatus
} from "../services/PhotoWorkspaceService";
import RecentFilesService from "../services/RecentFilesService";
import TemplateDocumentReader from "../services/TemplateDocumentReader";
import TemplateRegistry from "../services/TemplateRegistry";
import Template from "../templates/Template";
import ProjectTemplateRegistry from "../project/ProjectTemplateRegistry";
import Logger from "../core/photoshop/Logger";
import PhotoPlacementEngine from "../placement/PhotoPlacementEngine";
import PlacementExecutionPlanBuilder from "../placement/PlacementExecutionPlanBuilder";
import ReplacementRequest from "../placement/ReplacementRequest";
import ReplacementBatchExecutor from "../placement/ReplacementBatchExecutor";
import ReplacementStepExecutor from "../placement/ReplacementStepExecutor";
import { ExecutionStatus } from "../placement/ExecutionSummary";
import BatchProgress from "../placement/BatchProgress";
import ProjectExecutor from "../project/ProjectExecutor";
import ProjectExecutionSummary, {
    ProjectExecutionStatus
} from "../project/ProjectExecutionSummary";
import BatchRecoverySnapshot from "../project/BatchRecoverySnapshot";
import TemplateAutoSaveService, {
    AutoSaveMode
} from "../services/TemplateAutoSaveService";
import TemplateExportService, {
    ExportFormat
} from "../services/TemplateExportService";
import BatchCancellationController from "../project/BatchCancellationController";
import calculateBatchProgress from "../project/calculateBatchProgress";
import TemplateRegistryPreflightService from "../services/TemplateRegistryPreflightService";
import { TemplateRegistryValidationState } from "../project/TemplateRegistryValidationState";
import TemplateRegistryRecoveryCompatibilityService from
    "../project/TemplateRegistryRecoveryCompatibility";
import {
    canAutomaticallyRetryTemplateOutcome,
    isTemplateOutputCompleteByDefault,
    snapshotTemplateOutputTransactions,
    templateOutputRetryDisposition
} from "../project/OutputTransactionRecovery";
import { summarizeOutputRecovery } from
    "../project/OutputRecoveryOperatorState";
import {
    createAlbumSheetRenderRequest,
    validateAlbumSheetRenderRequest
} from "../project/AlbumSheetRenderBridge";

export const ExecutionLifecycleStatus = Object.freeze({
    IDLE: "IDLE",
    READY: "READY",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

export const RecoveryClearStatus = Object.freeze({
    CLEARED: "CLEARED",
    NOT_PRESENT: "NOT_PRESENT",
    FAILED: "FAILED"
});

export class AppController {

    constructor() {

        this.library = new LibraryEngine();
        this.project = new ProjectEngine();
        this.selection = new SelectionEngine(this.library);
        this.recentProjects = new RecentFilesService();
        this.projectService = new ProjectService({
            projectEngine: this.project,
            recentProjects: this.recentProjects
        });
        this.photoWorkspace = new PhotoWorkspaceService({
            library: this.library,
            selection: this.selection,
            projectEngine: this.project,
            projectService: this.projectService
        });
        this.templateDocumentReader = new TemplateDocumentReader({
            projectEngine: this.project
        });
        this.templateRegistry = new TemplateRegistry();
        this.projectTemplateRegistry = new ProjectTemplateRegistry();
        this.templateRegistryPreflightService = new TemplateRegistryPreflightService();
        this.currentTemplateRegistryPreflightState = this.emptyTemplateRegistryPreflightState();
        this.lastTemplateRegistryPreflightResult = this.currentTemplateRegistryPreflightState;
        this.templateRegistryRecoveryCompatibilityService =
            new TemplateRegistryRecoveryCompatibilityService();
        this.lastTemplateRegistryExecutionGateResult = null;
        this.photoPlacementEngine = new PhotoPlacementEngine();
        this.placementExecutionPlanBuilder = new PlacementExecutionPlanBuilder();
        this.currentPlacementPlan = null;
        this.currentPlacementExecutionPlan = null;
        this.currentReplacementRequest = null;
        this.currentAlbumSheetRenderRequest = null;
        this.replacementStepExecutor = new ReplacementStepExecutor();
        this.replacementBatchExecutor = new ReplacementBatchExecutor({
            replacementStepExecutor: this.replacementStepExecutor
        });
        this.currentExecutionSummary = null;
        this.currentBatchProgress = new BatchProgress();
        this.currentExecutionLifecycle = this.executionLifecycle();
        this.currentExecutionPromise = null;
        this.autoSaveEnabled = false;
        this.autoSaveMode = AutoSaveMode.SAVE_COPY;
        this.currentAutoSaveResult = null;
        this.exportEnabled = false;
        this.exportFormat = ExportFormat.JPEG;
        this.currentExportResult = null;
        this.templateAutoSaveService = new TemplateAutoSaveService({
            documentManager: this.replacementStepExecutor.documentManager
        });
        this.templateExportService = new TemplateExportService({
            documentManager: this.replacementStepExecutor.documentManager
        });
        this.projectExecutor = new ProjectExecutor({
            templateRegistry: this.templateRegistry,
            photoPlacementEngine: this.photoPlacementEngine,
            placementExecutionPlanBuilder: this.placementExecutionPlanBuilder,
            replacementBatchExecutor: this.replacementBatchExecutor,
            templateAutoSaveService: this.templateAutoSaveService,
            templateExportService: this.templateExportService
        });
        this.currentProjectExecutionSummary = null;
        this.batchRecoverySnapshot = null;
        this.batchRecoveryClassification = null;
        this.batchRecoveryDiagnostics = null;
        this.recoveryWritePromise = Promise.resolve();
        this.recoveryWriteGeneration = 0;
        this.lastRecoveryClearResult = null;
        this.projectBatchRunning = false;
        this.batchCancellationController = null;
        this.projectBatchUpdate = null;
        console.info("ALB-034-safe-batch-cancel-v1");
        console.info("ALB-034.1-cancel-outcome-progress-fix-v1");
        console.info("ALB-035-retry-failed-v1");
        console.info("ALB-037.1-no-photo-preflight-v1");
        this.registryMutationInProgress = false;

    }

    async createProject(options) {

        const project = await this.projectService.createProject(options);

        if (project) {
            this.templateRegistry.clear();
            this.projectTemplateRegistry = new ProjectTemplateRegistry(project.metadata.templateRegistry);
            this.loadRecovery(project.metadata.batchRecovery);
            this.clearCurrentPlacementPlan();
        }

        return project;

    }

    async openProject(folder) {

        const project = await this.projectService.openProject(folder);

        if (project) {
            this.templateRegistry.clear();
            this.projectTemplateRegistry = new ProjectTemplateRegistry(project.metadata.templateRegistry);
            this.loadRecovery(project.metadata.batchRecovery);
            this.clearCurrentPlacementPlan();
            this.currentTemplateRegistryPreflightState =
                this.templateRegistryPreflightStateFromRegistry({
                    reason: "PROJECT_OPEN_PERSISTED_OBSERVATION",
                    persisted: true
                });
            await this.revalidateProjectTemplates({ reason: "PROJECT_OPEN" });
        }

        return this.project.getProject();

    }

    saveProject(values, options) {

        return this.projectService.saveProject({
            ...values,
            templateRegistry: this.projectTemplateRegistry.toJSON(),
            batchRecovery: this.serializeRecoverySnapshot(this.batchRecoverySnapshot)
        }, options);

    }

    isAlbumSheetMutationLocked() {

        const lifecycle = this.currentProjectExecutionSummary?.batchProgress?.lifecycle;
        return this.projectBatchRunning || [
            "RUNNING",
            "CANCEL_REQUESTED",
            "CANCELLING"
        ].includes(lifecycle);

    }

    async saveAlbumSheetMutation(history, mutation) {

        if (this.isAlbumSheetMutationLocked()) {
            throw new Error("A project batch is running. Sheet changes are available after it stops safely.");
        }

        return this.projectService.saveAlbumSheetMutation(history, mutation, {
            templateIds: this.projectTemplateRegistry.getAll().map(template => template.id)
        });

    }

    async saveAlbumSheetHistory(previousHistory, nextHistory) {

        if (this.isAlbumSheetMutationLocked()) {
            throw new Error("A project batch is running. Sheet changes are available after it stops safely.");
        }

        return this.projectService.saveAlbumSheetHistory(previousHistory, nextHistory);

    }

    async closeProject() {

        if (this.projectBatchRunning) {
            throw new Error("A project batch is running. Request cancellation and wait for it to stop safely.");
        }

        if (this.project.getProject()) {
            await this.photoWorkspace.waitForPersistence();
            await this.saveProject(
                undefined,
                { reason: "CLOSE_PROJECT" }
            );
        }

        await this.photoWorkspace.release();
        this.templateRegistry.clear();
        this.projectTemplateRegistry = new ProjectTemplateRegistry();
        this.batchRecoverySnapshot = null;
        this.batchRecoveryClassification = null;
        this.batchRecoveryDiagnostics = null;
        this.currentTemplateRegistryPreflightState = this.emptyTemplateRegistryPreflightState();
        this.lastTemplateRegistryPreflightResult = this.currentTemplateRegistryPreflightState;
        this.lastTemplateRegistryExecutionGateResult = null;
        this.clearCurrentPlacementPlan();

        return this.projectService.closeProject();

    }

    getRecentProjects() {

        return this.projectService.getRecentProjects();

    }

    async importPhotos(folder) {

        const photos = await this.photoWorkspace.importPhotos(folder);

        if (photos) {
            this.clearCurrentPlacementPlan();
        }

        return photos;

    }

    async refreshPhotos() {

        const photos = await this.photoWorkspace.refreshPhotos();

        this.clearCurrentPlacementPlan();

        return photos;

    }

    async preparePhotoFolderChange(folder = null) {

        if (this.projectBatchRunning) {
            return Object.freeze({
                status:
                    PhotoFolderChangeStatus.BLOCKED_ACTIVE_BATCH
            });
        }

        const prepared =
            await this.photoWorkspace
                .preparePhotoFolderChange(folder);
        if (
            prepared.status ===
            PhotoFolderChangeStatus.PREPARED
        ) {
            return Object.freeze({
                ...prepared,
                recoveryDecisionRequired:
                    Boolean(this.batchRecoverySnapshot),
                recoveryClassification:
                    this.batchRecoveryClassification
            });
        }
        return prepared;

    }

    async commitPhotoFolderChange(
        prepared,
        { clearRecovery = false } = {}
    ) {

        if (this.projectBatchRunning) {
            return Object.freeze({
                status:
                    PhotoFolderChangeStatus.BLOCKED_ACTIVE_BATCH
            });
        }

        if (
            prepared?.status ===
            PhotoFolderChangeStatus.SAME_FOLDER
        ) {
            const result = await this.photoWorkspace
                .commitPreparedPhotoFolderChange(prepared);
            if (
                result.status ===
                PhotoFolderChangeStatus.SAME_FOLDER
            ) {
                this.clearCurrentPlacementPlan();
            }
            return result;
        }

        const recoveryPresent =
            Boolean(this.batchRecoverySnapshot);
        if (recoveryPresent && !clearRecovery) {
            return Object.freeze({
                status:
                    PhotoFolderChangeStatus
                        .RECOVERY_DECISION_REQUIRED,
                transactionId:
                    prepared?.transactionId || null,
                recoveryClassification:
                    this.batchRecoveryClassification
            });
        }

        if (recoveryPresent) {
            // Prevent an older checkpoint callback from writing old-photo
            // recovery after the authoritative folder-change save.
            this.recoveryWriteGeneration += 1;
            await this.recoveryWritePromise.catch(() => null);
        }

        const result = await this.photoWorkspace
            .commitPreparedPhotoFolderChange(
                prepared,
                {
                    projectValues: {
                        templateRegistry:
                            this.projectTemplateRegistry.toJSON(),
                        batchRecovery: recoveryPresent
                            ? null
                            : this.serializeRecoverySnapshot(
                                this.batchRecoverySnapshot
                            )
                    }
                }
            );

        if (result.status === PhotoFolderChangeStatus.SUCCESS) {
            if (recoveryPresent) {
                this.batchRecoverySnapshot = null;
                this.batchRecoveryClassification = null;
            }
            this.clearCurrentPlacementPlan();
        }
        return result;

    }

    getPhotoFolderStatus() {

        return this.photoWorkspace.getPhotoFolderStatus();

    }

    markPhotoFolderUnavailable() {

        this.photoWorkspace.markPhotoFolderUnavailable();

    }

    async removePhotos() {

        await this.photoWorkspace.removePhotos();
        this.clearCurrentPlacementPlan();

    }

    planPhotoPlacement(options = {}) {

        const project = this.project.getProject();
        const photos = this.photoWorkspace.getPhotos();
        const template = this.templateRegistry.current();

        if (!project) throw new Error("Create or open a project to continue.");
        if (!photos.length) throw new Error("No photos are available.");
        if (!template) throw new Error("No template is open.");
        if (!template.smartObjects?.length) {
            throw new Error("No Smart Object slots are available.");
        }

        let placement;

        try {
            placement = this.photoPlacementEngine.plan({
                project,
                photos,
                template,
                options
            });
        }

        catch (error) {
            throw new Error(this.userError(error, "Placement plan is not ready."));
        }

        this.currentPlacementPlan = placement;
        this.clearCurrentPlacementExecutionPlan();

        return placement;

    }

    getCurrentPlacementPlan() {

        return this.currentPlacementPlan;

    }

    clearCurrentPlacementPlan() {

        this.currentPlacementPlan = null;
        this.clearCurrentAlbumSheetRenderRequest();
        this.clearCurrentPlacementExecutionPlan();
        this.clearProjectExecutionSummary();
        this.clearCurrentAutoSaveResult();
        this.clearCurrentExportResult();

    }

    buildPlacementExecutionPlan() {

        if (!this.currentPlacementPlan) {
            throw new Error("Placement plan is not ready.");
        }

        let executionPlan;

        try {
            executionPlan = this.placementExecutionPlanBuilder.build({
                placementResult: this.currentPlacementPlan,
                project: this.project.getProject(),
                template: this.templateRegistry.current(),
                photos: this.photoWorkspace.getPhotos()
            });
        }

        catch (error) {
            throw new Error(this.userError(error, "Execution plan is not ready."));
        }

        this.currentPlacementExecutionPlan = executionPlan;
        this.clearCurrentReplacementRequest();
        this.buildReplacementRequest();
        this.setExecutionLifecycle(ExecutionLifecycleStatus.READY);

        return executionPlan;

    }

    getCurrentPlacementExecutionPlan() {

        return this.currentPlacementExecutionPlan;

    }

    clearCurrentPlacementExecutionPlan() {

        this.currentPlacementExecutionPlan = null;
        this.clearCurrentReplacementRequest();

    }

    createAlbumSheetRenderRequest(sheetId) {

        const project = this.project.getProject();
        const result = createAlbumSheetRenderRequest({
            projectId: project?.metadata?.id ?? project?.metadata?.name ?? null,
            album: project?.metadata?.album,
            registry: this.projectTemplateRegistry.getAll(),
            sheetId,
            selectedPhotoIds: this.selectedPhotoIds()
        });
        this.currentAlbumSheetRenderRequest = result.accepted ? result.request : null;
        return result;

    }

    getCurrentAlbumSheetRenderRequest() {

        return this.currentAlbumSheetRenderRequest;

    }

    clearCurrentAlbumSheetRenderRequest() {

        this.currentAlbumSheetRenderRequest = null;

    }

    async executeAlbumSheetRenderRequest(request, onUpdate) {

        if (this.isAlbumSheetMutationLocked()) {
            throw new Error("A project batch is running. Sheet rendering is available after it stops safely.");
        }

        // Revalidate before the stale-request gate. This uses the existing
        // registry observation/persistence policy and does not open a PSD.
        const preflight = await this.revalidateProjectTemplates({
            reason: "ALBUM_SHEET_RENDER_PREFLIGHT"
        });
        if (!preflight.persisted && String(preflight.reason).endsWith("PERSISTENCE_FAILED")) {
            throw new Error("Template registry observations could not be saved.");
        }

        const project = this.project.getProject();
        const candidate = request || this.currentAlbumSheetRenderRequest;
        const validation = validateAlbumSheetRenderRequest(candidate, {
            projectId: project?.metadata?.id ?? project?.metadata?.name ?? null,
            album: project?.metadata?.album,
            registry: this.projectTemplateRegistry.getAll(),
            selectedPhotoIds: this.selectedPhotoIds()
        });
        if (!validation.accepted) {
            const error = new Error("Album Sheet render request is stale or no longer renderable.");
            error.code = "ALBUM_SHEET_RENDER_REJECTED";
            error.reasonCodes = validation.reasonCodes;
            throw error;
        }

        const descriptor = this.projectTemplateRegistry.getAll().find(template =>
            template.id === validation.request.template.id
        );
        if (!descriptor) {
            const error = new Error("Album Sheet template is no longer registered.");
            error.code = "ALBUM_SHEET_RENDER_REJECTED";
            error.reasonCodes = ["TEMPLATE_REGISTRY_STALE"];
            throw error;
        }

        return this.executeProject(onUpdate, {
            templates: [descriptor],
            selectedPhotoIds: validation.request.selectedPhotoIds,
            runMode: "ALBUM_SHEET_RENDER"
        });

    }

    buildReplacementRequest() {

        if (!this.currentPlacementExecutionPlan) {
            throw new Error("Execution plan is not ready.");
        }

        this.clearCurrentReplacementRequest();

        const request = new ReplacementRequest({
            executionPlan: this.currentPlacementExecutionPlan
        });

        this.currentReplacementRequest = request;

        return request;

    }

    getCurrentReplacementRequest() {

        return this.currentReplacementRequest;

    }

    clearCurrentReplacementRequest() {

        this.currentReplacementRequest = null;
        this.clearExecutionSummary();
        this.clearBatchProgress();
        this.clearCurrentAutoSaveResult();
        this.clearCurrentExportResult();
        this.setExecutionLifecycle(ExecutionLifecycleStatus.IDLE);

    }

    async executeReplacementBatch(onProgress) {

        if (this.currentExecutionLifecycle.status === ExecutionLifecycleStatus.RUNNING) {
            return this.currentExecutionPromise;
        }

        const validationError = this.executionValidationError();

        if (validationError) {
            this.setExecutionLifecycle(ExecutionLifecycleStatus.FAILED, validationError);
            throw new Error(validationError);
        }

        this.currentExecutionPromise = this.runReplacementBatch(onProgress);

        try {
            return await this.currentExecutionPromise;
        }

        finally {
            this.currentExecutionPromise = null;
        }

    }

    async runReplacementBatch(onProgress) {

        const project = this.project.getProject();
        const request = this.currentReplacementRequest;

        this.clearExecutionSummary();
        this.clearBatchProgress();
        this.clearCurrentAutoSaveResult();
        this.clearCurrentExportResult();
        this.setExecutionLifecycle(ExecutionLifecycleStatus.RUNNING);

        try {
            this.currentExecutionSummary = await this.replacementBatchExecutor.execute(
                request,
                {
                    photos: this.photoWorkspace.getPhotos(),
                    templateName: this.templateRegistry.current()?.name || "",
                    onProgress: progress => {
                        this.currentBatchProgress = progress;

                        if (typeof onProgress === "function") onProgress(progress);
                    }
                }
            );

            this.replacementStepExecutor.documentManager.sync();
            this.currentAutoSaveResult = await this.templateAutoSaveService.save({
                project,
                template: this.templateRegistry.current(),
                executionSummary: this.currentExecutionSummary,
                enabled: this.autoSaveEnabled,
                mode: this.autoSaveMode
            });
            this.currentExportResult = await this.templateExportService.export({
                project,
                template: this.templateRegistry.current(),
                autoSaveResult: this.currentAutoSaveResult,
                enabled: this.exportEnabled,
                format: this.exportFormat
            });

            const status = this.currentExecutionSummary?.status === ExecutionStatus.COMPLETED
                ? ExecutionLifecycleStatus.COMPLETED
                : ExecutionLifecycleStatus.FAILED;
            this.setExecutionLifecycle(status);

            return this.currentExecutionSummary;
        }

        catch (error) {
            const message = this.userError(error, "Replacement failed.");
            this.setExecutionLifecycle(ExecutionLifecycleStatus.FAILED, message);
            throw new Error(message);
        }

        finally {
            this.replacementStepExecutor.documentManager.sync();
        }

    }

    executionValidationError() {

        const project = this.project.getProject();
        const template = this.templateRegistry.current();
        const photos = this.photoWorkspace.getPhotos();
        const selectedPhotos = photos.filter(photo => photo?.selected);
        const placement = this.currentPlacementPlan;
        const executionPlan = this.currentPlacementExecutionPlan;
        const request = this.currentReplacementRequest;
        const documentId = template?.document?.id;
        const document = documentId == null
            ? null
            : this.replacementStepExecutor.documentManager.byId(documentId);

        if (!project) return "Create or open a project to continue.";
        if (!template || !document) return "Template document is not active.";
        if (!selectedPhotos.length) return "No photos are selected.";
        if (!template.smartObjects?.length) return "No Smart Object slots are available.";
        if (!placement?.assignments?.length) return "Placement plan is not ready.";
        if (!executionPlan?.steps?.length || executionPlan.status !== "READY") {
            return "Execution plan is not ready.";
        }
        if (!request?.steps?.length) return "Replacement request is not ready.";
        if (placement.assignments.length !== executionPlan.steps.length ||
            executionPlan.steps.length !== request.steps.length) {
            return "Placement assignments and execution steps are inconsistent.";
        }

        return null;

    }

    executionLifecycle(status = ExecutionLifecycleStatus.IDLE, error = null) {

        return Object.freeze({
            status,
            error,
            updatedAt: new Date().toISOString()
        });

    }

    setExecutionLifecycle(status, error = null) {

        this.currentExecutionLifecycle = this.executionLifecycle(status, error);

    }

    getCurrentExecutionLifecycle() {

        return this.currentExecutionLifecycle;

    }

    getCurrentExecutionSummary() {

        return this.currentExecutionSummary;

    }

    clearExecutionSummary() {

        this.currentExecutionSummary = null;

    }

    getCurrentBatchProgress() {

        return this.currentBatchProgress;

    }

    clearBatchProgress() {

        this.currentBatchProgress = new BatchProgress();

    }

    setAutoSaveEnabled(enabled) {

        this.autoSaveEnabled = enabled === true;
        this.clearCurrentAutoSaveResult();
        this.clearCurrentExportResult();

    }

    getAutoSaveEnabled() {

        return this.autoSaveEnabled;

    }

    setAutoSaveMode(mode) {

        if (!Object.values(AutoSaveMode).includes(mode)) {
            throw new Error("Auto Save mode is unavailable.");
        }

        this.autoSaveMode = mode;
        this.clearCurrentAutoSaveResult();
        this.clearCurrentExportResult();

    }

    getAutoSaveMode() {

        return this.autoSaveMode;

    }

    getCurrentAutoSaveResult() {

        return this.currentAutoSaveResult;

    }

    clearCurrentAutoSaveResult() {

        this.currentAutoSaveResult = null;

    }

    setExportEnabled(enabled) {

        this.exportEnabled = enabled === true;
        this.clearCurrentExportResult();

    }

    getExportEnabled() {

        return this.exportEnabled;

    }

    setExportFormat(format) {

        if (!Object.values(ExportFormat).includes(format)) {
            throw new Error("Export format is unavailable.");
        }

        this.exportFormat = format;
        this.clearCurrentExportResult();

    }

    getExportFormat() {

        return this.exportFormat;

    }

    getCurrentExportResult() {

        return this.currentExportResult;

    }

    clearCurrentExportResult() {

        this.currentExportResult = null;

    }

    async executeProject(onUpdate, options = {}) {

        if (this.projectBatchRunning ||
            this.currentProjectExecutionSummary?.batchProgress?.lifecycle === "RUNNING") {
            throw new Error("A project batch is already running.");
        }
        const executionPreflight = await this.revalidateProjectTemplates({
            reason: "PROCESS_PROJECT_PREFLIGHT"
        });
        if (executionPreflight.reason ===
            "PROCESS_PROJECT_PREFLIGHT_PERSISTENCE_FAILED") {
            return this.blockTemplateRegistryExecution({
                status: "TEMPLATE_REGISTRY_PREFLIGHT_PERSISTENCE_FAILED",
                preflight: executionPreflight,
                blockingReasonCodes: ["OBSERVATION_PERSISTENCE_FAILED"]
            });
        }
        const compatibility =
            this.templateRegistryRecoveryCompatibilityService.evaluate({
                descriptors: this.projectTemplateRegistry.getAll(),
                recoverySnapshot: this.batchRecoverySnapshot
            });
        if (executionPreflight.blocking > 0) {
            return this.blockTemplateRegistryExecution({
                status: "TEMPLATE_REGISTRY_BLOCKED",
                preflight: executionPreflight,
                blockingReasonCodes: compatibility.blockingReasonCodes,
                recoveryCompatibility: compatibility.recoveryCompatibility
            });
        }
        this.lastTemplateRegistryExecutionGateResult = Object.freeze({
            status: "READY",
            counts: this.templateRegistryExecutionCounts(executionPreflight),
            blockingReasonCodes: Object.freeze([]),
            checkpointCreated: false,
            recoveryMutated: false,
            documentsOpened: 0,
            recoveryCompatibility: compatibility.recoveryCompatibility
        });

        const project = this.project.getProject();
        const registryTemplates = this.projectTemplateRegistry.getAll();
        const templates = options.templates || registryTemplates;
        const resumeSnapshot = ["RESUME_PENDING", "RETRY_FAILED"].includes(options.runMode)
            ? options.previous
            : null;
        const initialTotalTemplates = resumeSnapshot?.queueOrder?.length || templates.length;
        const retryingFailed = options.runMode === "RETRY_FAILED";
        const initialCompletedTemplates = retryingFailed
            ? (resumeSnapshot?.successfulTemplateIds?.length || 0)
            : (resumeSnapshot?.completedTemplateIds?.length || 0);
        const initialSuccessfulTemplates = resumeSnapshot?.successfulTemplateIds?.length || 0;
        const initialFailedTemplates = retryingFailed ? 0 : (resumeSnapshot?.failedTemplateIds?.length || 0);
        const photos = this.photoWorkspace.getPhotos();
        const selectedPhotoIds = Array.isArray(options.selectedPhotoIds)
            ? options.selectedPhotoIds.slice()
            : null;
        const selectedPhotos = selectedPhotoIds
            ? selectedPhotoIds.map(id => photos.find(photo => photo?.id === id)).filter(Boolean)
            : photos.filter(photo => photo?.selected);
        const startedAt = new Date().toISOString();
        const projectId = project?.metadata?.id ?? project?.metadata?.name ?? null;

        // Fresh project processing requires an explicit selection. Recovery
        // runs retain their persisted selection and are validated downstream.
        if (!options.runMode && !selectedPhotos.length) {
            const error = new Error("Select at least one photo before processing.");
            error.code = "NO_SELECTED_PHOTOS";
            throw error;
        }

        this.clearExecutionSummary();
        this.clearBatchProgress();
        this.clearProjectExecutionSummary();
        this.clearCurrentAutoSaveResult();
        this.clearCurrentExportResult();

        if (!project || !templates.length || !photos.length) {
            this.currentProjectExecutionSummary = new ProjectExecutionSummary({
                projectId,
                totalTemplates: templates.length,
                completedTemplates: 0,
                failedTemplates: 0,
                templateResults: [],
                startedAt,
                finishedAt: startedAt,
                elapsedMilliseconds: 0,
                status: ProjectExecutionStatus.FAILED,
                registeredTemplates: this.projectTemplateRegistry.count(),
                registryValidationError: !templates.length ? "Register at least one PSD before processing the project." : null
            });

            if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);

            return this.currentProjectExecutionSummary;
        }

        this.projectBatchRunning = true;
        this.batchCancellationController = new BatchCancellationController();
        this.projectBatchUpdate = onUpdate;
        try {
            await this.beginRecoverySnapshot({
                projectId,
                templates,
                registryTemplates,
                previous: options.previous || null,
                runMode: options.runMode || "PROCESS_PROJECT",
                startedAt,
                selectedPhotoIds
            });
        } catch (error) {
            this.projectBatchRunning = false;
            throw error;
        }

        this.currentProjectExecutionSummary = new ProjectExecutionSummary({
            projectId,
            totalTemplates: initialTotalTemplates,
            registeredTemplates: this.projectTemplateRegistry.count(),
            completedTemplates: initialCompletedTemplates,
            successfulTemplates: initialSuccessfulTemplates,
            failedTemplates: initialFailedTemplates,
            templateResults: [],
            startedAt,
            batchProgress: this.projectBatchProgress({
                lifecycle: "RUNNING", stage: "OPENING", totalTemplates: initialTotalTemplates,
                completedTemplates: initialCompletedTemplates, successfulTemplates: initialSuccessfulTemplates,
                failedTemplates: initialFailedTemplates,
                retainedProgressPercent: resumeSnapshot?.retainedProgressPercent || 0
            }),
            status: ProjectExecutionStatus.RUNNING
        });

        if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);

        try {
        this.currentProjectExecutionSummary = await this.projectExecutor.execute({
            project,
            photos,
            templates,
            registeredTemplates: this.projectTemplateRegistry.count(),
            resolveTemplate: async descriptor => {
                try {
                    const analysis = await this.templateDocumentReader.resolveRegisteredTemplate(descriptor);
                    this.projectTemplateRegistry.updateValidation(descriptor.id, "VALID");
                    return new Template(analysis);
                } catch (error) {
                    this.projectTemplateRegistry.updateValidation(descriptor.id, "MISSING");
                    throw error;
                }
            },
            releaseTemplate: async () => this.templateDocumentReader.close(),
            autoSaveEnabled: this.autoSaveEnabled,
            autoSaveMode: this.autoSaveMode,
            onAutoSaveResult: result => {
                this.currentAutoSaveResult = result;
            },
            exportEnabled: this.exportEnabled,
            exportFormat: this.exportFormat,
            selectedPhotoIds: this.batchRecoverySnapshot?.selectedPhotoOrder ||
                selectedPhotoIds || photos.filter(photo => photo?.selected).map(photo => photo.id),
            photoCursor: this.batchRecoverySnapshot?.photoCursor || 0,
            cancellationController: this.batchCancellationController,
            resumeState: resumeSnapshot ? {
                totalTemplates: initialTotalTemplates,
                completedTemplates: initialCompletedTemplates,
                successfulTemplates: initialSuccessfulTemplates,
                failedTemplates: initialFailedTemplates,
                skippedTemplates: 0,
                templateIndexes: Object.fromEntries(
                    (resumeSnapshot?.queueOrder || []).map((id, index) => [id, index])
                )
            } : null,
            onExportResult: result => {
                this.currentExportResult = result;
            },
            onStageProgress: progress => {
                const current = this.currentProjectExecutionSummary;
                const batch = current?.batchExecution;
                this.currentProjectExecutionSummary = new ProjectExecutionSummary({
                    ...current,
                    totalTemplates: progress.total,
                    registeredTemplates: this.projectTemplateRegistry.count(),
                    batchProgress: this.projectBatchProgress({
                        lifecycle: batch?.status || "RUNNING",
                        stage: progress.stage,
                        currentTemplate: progress.descriptor,
                        templateIndex: progress.index,
                        totalTemplates: progress.total,
                        completedTemplates: batch?.completedTemplates || 0,
                        successfulTemplates: batch?.successfulTemplates || 0,
                        failedTemplates: batch?.failedTemplates || 0
                        ,retainedProgressPercent: batch?.retainedProgressPercent || this.batchCancellationController?.getSnapshot().retainedProgressPercent || 0
                    })
                });
                if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);
            },
            onProgress: batch => {
                this.currentProjectExecutionSummary = new ProjectExecutionSummary({
                    projectId,
                    totalTemplates: batch.totalTemplates,
                    registeredTemplates: this.projectTemplateRegistry.count(),
                    completedTemplates: batch.completedTemplates,
                    successfulTemplates: batch.successfulTemplates,
                    failedTemplates: batch.failedTemplates,
                    skippedTemplates: batch.skippedTemplates,
                    templateResults: batch.templateResults,
                    batchExecution: batch,
                    batchProgress: this.projectBatchProgress({
                        lifecycle: batch.status,
                        stage: ["CANCELLING", "CANCELLED"].includes(batch.status)
                            ? (batch.cancelledAtStage || this.currentProjectExecutionSummary?.batchProgress?.stage || "IDLE")
                            : (this.currentProjectExecutionSummary?.batchProgress?.stage || "IDLE"),
                        currentTemplate: batch.currentTemplate || this.currentProjectExecutionSummary?.batchProgress?.currentTemplate,
                        templateIndex: batch.templateIndex ?? this.currentProjectExecutionSummary?.batchProgress?.templateIndex,
                        totalTemplates: batch.totalTemplates,
                        completedTemplates: batch.completedTemplates,
                        successfulTemplates: batch.successfulTemplates,
                        failedTemplates: batch.failedTemplates
                        ,skippedTemplates: batch.skippedTemplates
                        ,retainedProgressPercent: batch.retainedProgressPercent || this.batchCancellationController?.getSnapshot().retainedProgressPercent || 0
                    }),
                    startedAt: batch.startedAt,
                    elapsedMilliseconds: batch.durationMs,
                    status: ProjectExecutionStatus.RUNNING
                });
                this.updateRecoveryBatch(batch);
                if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);
            }
        });
        } catch (error) {
            this.markRecoveryFatal(error);
            this.currentProjectExecutionSummary = new ProjectExecutionSummary({
                projectId,
                totalTemplates: templates.length,
                registeredTemplates: this.projectTemplateRegistry.count(),
                completedTemplates: this.batchRecoverySnapshot?.completedTemplateIds?.length || 0,
                successfulTemplates: this.batchRecoverySnapshot?.successfulTemplateIds?.length || 0,
                failedTemplates: this.batchRecoverySnapshot?.failedTemplateIds?.length || 0,
                startedAt,
                finishedAt: new Date().toISOString(),
                batchProgress: this.projectBatchProgress({
                    lifecycle: "FAILED",
                    stage: "FAILED",
                    totalTemplates: templates.length,
                    completedTemplates: this.batchRecoverySnapshot?.completedTemplateIds?.length || 0,
                    successfulTemplates: this.batchRecoverySnapshot?.successfulTemplateIds?.length || 0,
                    failedTemplates: this.batchRecoverySnapshot?.failedTemplateIds?.length || 0
                }),
                status: ProjectExecutionStatus.FAILED
            });
            try {
                await this.flushRecoveryWrites();
            } finally {
                this.projectBatchRunning = false;
                this.projectBatchUpdate = null;
                this.batchCancellationController = null;
            }
            if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);
            return this.currentProjectExecutionSummary;
        }

        this.updateRecoveryBatch(this.currentProjectExecutionSummary.batchExecution);
        try {
            await this.flushRecoveryWrites();
        } finally {
            this.projectBatchRunning = false;
            this.projectBatchUpdate = null;
            this.batchCancellationController = null;
        }
        if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);

        if (options.runMode === "RESUME_PENDING") {
            console.info("BATCH_RESUME_COMPLETED", JSON.stringify({
                totalTemplates: this.currentProjectExecutionSummary.totalTemplates,
                completed: this.currentProjectExecutionSummary.completedTemplates,
                successful: this.currentProjectExecutionSummary.successfulTemplates,
                failed: this.currentProjectExecutionSummary.failedTemplates,
                photoCursor: this.batchRecoverySnapshot?.photoCursor || 0,
                recoveryLifecycle: this.batchRecoverySnapshot?.lifecycle || null
            }));
        }
        if (options.runMode === "RETRY_FAILED") {
            const retryOutcome = {
                totalTemplates: this.currentProjectExecutionSummary.totalTemplates,
                completed: this.currentProjectExecutionSummary.completedTemplates,
                successful: this.currentProjectExecutionSummary.successfulTemplates,
                failed: this.currentProjectExecutionSummary.failedTemplates,
                pending: this.batchRecoverySnapshot?.pendingTemplateIds?.length || 0,
                successfulTemplateIds: this.batchRecoverySnapshot?.successfulTemplateIds || [],
                failedTemplateIds: this.batchRecoverySnapshot?.failedTemplateIds || [],
                photoCursor: this.batchRecoverySnapshot?.photoCursor || 0,
                recoveryLifecycle: this.batchRecoverySnapshot?.lifecycle || null
            };
            const retryCompleted = retryOutcome.failed === 0 &&
                retryOutcome.pending === 0 &&
                retryOutcome.successful === retryOutcome.totalTemplates &&
                retryOutcome.recoveryLifecycle === "COMPLETED";
            if (retryOutcome.recoveryLifecycle === "CANCELLED") {
                console.info("BATCH_RETRY_CANCELLED", JSON.stringify(retryOutcome));
            } else if (retryCompleted) {
                console.info("BATCH_RETRY_COMPLETED", JSON.stringify(retryOutcome));
            } else if (retryOutcome.failed > 0 &&
                retryOutcome.recoveryLifecycle === "COMPLETED_WITH_ERRORS") {
                console.info("BATCH_RETRY_FAILED_REMAINING", JSON.stringify(retryOutcome));
            }
        }

        return this.currentProjectExecutionSummary;

    }

    getCurrentProjectExecutionSummary() {

        return this.currentProjectExecutionSummary;

    }

    requestBatchCancellation() {
        if (!this.projectBatchRunning || !this.batchCancellationController) return null;
        const current = this.currentProjectExecutionSummary;
        this.batchCancellationController.captureProgress(calculateBatchProgress(current));
        const cancellation = this.batchCancellationController.requestCancel("USER_REQUEST");
        console.info("BATCH_CANCEL_REQUESTED", JSON.stringify(cancellation));
        if (["REPLACING", "SAVING", "EXPORTING", "CLOSING"].includes(current?.batchProgress?.stage)) {
            console.info("BATCH_CANCEL_DEFERRED", JSON.stringify({ stage: current.batchProgress.stage }));
        }
        if (current) {
            this.currentProjectExecutionSummary = new ProjectExecutionSummary({
                ...current,
                batchProgress: this.projectBatchProgress({
                    ...current.batchProgress,
                    lifecycle: "CANCEL_REQUESTED",
                    retainedProgressPercent: cancellation.retainedProgressPercent
                })
            });
            this.projectBatchUpdate?.(this.currentProjectExecutionSummary);
        }
        return cancellation;
    }

    async retryFailedTemplates(onUpdate) {
        const snapshot = this.requireRecoverableSnapshot();
        const outcomes = new Map((snapshot.templateOutcomes || []).map(item => [item.templateId, item]));
        const failed = new Set(snapshot.failedTemplateIds.filter(templateId =>
            canAutomaticallyRetryTemplateOutcome(outcomes.get(templateId) || {})
        ));
        const templates = this.projectTemplateRegistry.getAll().filter(item => failed.has(item.id));
        if (!templates.length) {
            const outputs = summarizeOutputRecovery(snapshot);
            if (outputs.automaticRetryBlocked) {
                throw new Error("Automatic retry is blocked for ambiguous or cleanup-required outputs.");
            }
            throw new Error("There are no failed templates to retry.");
        }
        const firstFailedAllocation = (snapshot.templateOutcomes || [])
            .find(item => failed.has(item.templateId))?.photoAllocation;
        const retryCursor = Number.isInteger(firstFailedAllocation?.startCursor)
            ? firstFailedAllocation.startCursor
            : snapshot.photoCursor;
        const details = {
            totalTemplates: snapshot.queueOrder.length,
            completed: snapshot.successfulTemplateIds.length,
            successful: snapshot.successfulTemplateIds.length,
            failed: 0,
            pending: snapshot.failedTemplateIds.length,
            successfulTemplateIds: snapshot.successfulTemplateIds,
            failedTemplateIds: snapshot.failedTemplateIds,
            retryQueueTemplateIds: templates.map(item => item.id),
            photoCursor: retryCursor,
            recoveryLifecycle: snapshot.lifecycle
        };
        console.info("BATCH_RETRY_STARTED", JSON.stringify(details));
        console.info("BATCH_RETRY_STATE_RESTORED", JSON.stringify(details));
        console.info("BATCH_RETRY_QUEUE_BUILT", JSON.stringify(details));
        snapshot.queueOrder.filter(id => !failed.has(id)).forEach(templateId =>
            console.info("BATCH_RETRY_TEMPLATE_SKIPPED", JSON.stringify({ ...details, templateId }))
        );
        return this.executeProject(onUpdate, {
            templates,
            previous: {
                ...snapshot,
                photoCursor: retryCursor,
                consumedPhotoIds: snapshot.selectedPhotoOrder.slice(0, retryCursor),
                remainingPhotoIds: snapshot.selectedPhotoOrder.slice(retryCursor)
            },
            runMode: "RETRY_FAILED"
        });
    }

    async resumeProjectBatch(onUpdate) {
        const snapshot = this.requireRecoverableSnapshot();
        const successful = new Set(snapshot.successfulTemplateIds);
        const outcomes = new Map((snapshot.templateOutcomes || []).map(item => [item.templateId, item]));
        const required = new Set(snapshot.queueOrder.filter(id =>
            !successful.has(id) && canAutomaticallyRetryTemplateOutcome(outcomes.get(id) || {})
        ));
        const templates = this.projectTemplateRegistry.getAll().filter(item => required.has(item.id));
        if (!templates.length) {
            const outputs = summarizeOutputRecovery(snapshot);
            if (outputs.automaticRetryBlocked) {
                throw new Error("Automatic resume is blocked for ambiguous or cleanup-required outputs.");
            }
            throw new Error("There are no pending templates to resume.");
        }
        const details = {
            totalTemplates: snapshot.queueOrder.length,
            completed: snapshot.completedTemplateIds.length,
            successful: snapshot.successfulTemplateIds.length,
            failed: snapshot.failedTemplateIds.length,
            pending: snapshot.pendingTemplateIds.length,
            completedTemplateIds: snapshot.completedTemplateIds,
            pendingTemplateIds: snapshot.pendingTemplateIds,
            resumeQueueTemplateIds: templates.map(item => item.id),
            photoCursor: snapshot.photoCursor,
            recoveryLifecycle: snapshot.lifecycle
        };
        console.info("BATCH_RESUME_STARTED", JSON.stringify(details));
        console.info("BATCH_RESUME_STATE_RESTORED", JSON.stringify(details));
        console.info("BATCH_RESUME_QUEUE_BUILT", JSON.stringify(details));
        snapshot.completedTemplateIds.forEach(templateId =>
            console.info("BATCH_RESUME_TEMPLATE_SKIPPED", JSON.stringify({ templateId }))
        );
        return this.executeProject(onUpdate, {
            templates,
            previous: snapshot,
            runMode: "RESUME_PENDING"
        });
    }

    async clearRecoveryState() {
        if (this.projectBatchRunning) throw new Error("A project batch is already running.");
        const previousSnapshot = this.batchRecoverySnapshot;
        const previousClassification = this.batchRecoveryClassification;
        const previousDiagnostics = this.batchRecoveryDiagnostics;
        const recoveryWasPresent = Boolean(previousSnapshot);

        if (!recoveryWasPresent) {
            this.lastRecoveryClearResult = Object.freeze({
                status: RecoveryClearStatus.NOT_PRESENT,
                error: null
            });
            return this.lastRecoveryClearResult;
        }

        // Invalidate checkpoint callbacks that have not started, then wait for
        // any already-started write. The explicit null write below is therefore
        // guaranteed to be the last recovery persistence operation.
        this.recoveryWriteGeneration += 1;
        await this.recoveryWritePromise.catch(() => null);

        this.batchRecoverySnapshot = null;
        this.batchRecoveryClassification = null;
        this.batchRecoveryDiagnostics = null;

        try {
            await this.persistRecoverySnapshot(null, this.recoveryWriteGeneration);
            this.lastRecoveryClearResult = Object.freeze({
                status: RecoveryClearStatus.CLEARED,
                error: null
            });
        } catch (error) {
            this.batchRecoverySnapshot = previousSnapshot;
            this.batchRecoveryClassification = previousClassification;
            this.batchRecoveryDiagnostics = previousDiagnostics;
            this.lastRecoveryClearResult = Object.freeze({
                status: RecoveryClearStatus.FAILED,
                error: error?.message || "Recovery state could not be cleared."
            });
        }

        return this.lastRecoveryClearResult;
    }

    getBatchRecoveryState() {
        return this.recoveryState(
            this.batchRecoverySnapshot,
            this.batchRecoveryClassification
        );
    }

    projectBatchProgress(data = {}) {
        const totalTemplates = data.totalTemplates || 0;
        const completedTemplates = data.completedTemplates || 0;
        const failedTemplates = data.failedTemplates || 0;
        const skippedTemplates = data.skippedTemplates || 0;
        const successfulTemplates = data.successfulTemplates || 0;
        return Object.freeze({
            lifecycle: data.lifecycle || "IDLE",
            stage: data.stage || "IDLE",
            currentTemplate: data.currentTemplate || null,
            templateIndex: Number.isInteger(data.templateIndex) ? data.templateIndex : null,
            totalTemplates,
            completedTemplates,
            successfulTemplates,
            failedTemplates,
            skippedTemplates,
            remainingTemplates: Math.max(0, totalTemplates - completedTemplates),
            percentage: totalTemplates ? Math.round((completedTemplates / totalTemplates) * 100) : 0,
            retainedProgressPercent: Math.max(0, Number(data.retainedProgressPercent) || 0)
        });
    }

    registryRecoveryVersion(entries = this.projectTemplateRegistry.getAll()) {
        return entries.map(item => `${item.id}:${item.fileReference}`).join("|");
    }

    loadRecovery(raw) {
        const projectId = this.project.getProject()?.metadata?.id ?? null;
        if (!raw) {
            this.batchRecoverySnapshot = null;
            this.batchRecoveryClassification = null;
            this.batchRecoveryDiagnostics = null;
            return;
        }
        const validation = BatchRecoverySnapshot.validatePersisted(raw);
        this.batchRecoveryDiagnostics = validation;
        if (validation.status === "INCOMPATIBLE") {
            this.batchRecoverySnapshot = BatchRecoverySnapshot.freeze(raw);
            this.batchRecoveryClassification = "INCOMPATIBLE";
            return;
        }
        if (!validation.valid) {
            this.batchRecoverySnapshot = BatchRecoverySnapshot.freeze(raw);
            this.batchRecoveryClassification = "INVALID";
            return;
        }
        const snapshot = new BatchRecoverySnapshot(raw);
        this.batchRecoverySnapshot = snapshot;
        const stale = snapshot.projectId !== projectId ||
            snapshot.registryVersion !== this.registryRecoveryVersion();
        this.batchRecoveryClassification = stale ? "STALE" : null;
    }

    recoveryState(snapshot, forcedStatus = null) {
        if (!snapshot) {
            return Object.freeze({
                available: false,
                classification: forcedStatus || "NONE",
                snapshot: null,
                diagnostics: this.batchRecoveryDiagnostics,
                outputRecovery: summarizeOutputRecovery()
            });
        }
        const pending = snapshot.pendingTemplateIds?.length || 0;
        const failed = snapshot.failedTemplateIds?.length || 0;
        let classification = forcedStatus;
        if (!classification) {
            if (snapshot.lifecycle === "RUNNING") classification = "INTERRUPTED";
            else if (snapshot.lifecycle === "COMPLETED" && !pending && !failed) classification = "COMPLETED";
            else classification = "INTERRUPTED";
        }
        return Object.freeze({
            available: classification === "INTERRUPTED" && (pending > 0 || failed > 0),
            classification,
            snapshot,
            diagnostics: this.batchRecoveryDiagnostics,
            outputRecovery: summarizeOutputRecovery(snapshot)
        });
    }

    requireRecoverableSnapshot() {
        const state = this.getBatchRecoveryState();
        if (!state?.available || !state.snapshot) {
            throw new Error("No recoverable batch is available.");
        }
        const projectId = this.project.getProject()?.metadata?.id ?? null;
        if (state.snapshot.projectId !== projectId) throw new Error("Recovery state belongs to another project.");
        const registryIds = new Set(this.projectTemplateRegistry.getAll().map(item => item.id));
        if (state.snapshot.queueOrder.some(id => !registryIds.has(id))) {
            throw new Error("The project template registry no longer matches the recovery state.");
        }
        return state.snapshot;
    }

    async beginRecoverySnapshot({ projectId, templates, registryTemplates, previous, runMode, startedAt, selectedPhotoIds = null }) {
        const queueOrder = previous?.queueOrder?.length
            ? previous.queueOrder
            : templates.map(item => item.id);
        const successfulTemplateIds = previous?.successfulTemplateIds || [];
        const selectedPhotoOrder = previous?.selectedPhotoOrder?.length
            ? previous.selectedPhotoOrder
            : (Array.isArray(selectedPhotoIds) && selectedPhotoIds.length
                ? selectedPhotoIds.slice()
                : this.photoWorkspace.getPhotos()
                .filter(photo => photo?.selected)
                .map(photo => photo.id));
        const photoCursor = previous?.photoCursor || 0;
        this.batchRecoverySnapshot = new BatchRecoverySnapshot({
            recoveryVersion: (previous?.recoveryVersion || 0) + 1,
            projectId,
            registryVersion: this.registryRecoveryVersion(registryTemplates),
            registrySnapshot: registryTemplates.map(item => ({
                id: item.id,
                name: item.name,
                fileReference: item.fileReference,
                registrationOrder: item.registrationOrder
            })),
            queueOrder,
            lifecycle: "RUNNING",
            startedAt,
            updatedAt: startedAt,
            completedTemplateIds: successfulTemplateIds,
            successfulTemplateIds,
            failedTemplateIds: [],
            pendingTemplateIds: queueOrder.filter(id => !successfulTemplateIds.includes(id)),
            currentTemplateId: templates[0]?.id ?? null,
            currentTemplateIndex: 0,
            lastCompletedStage: "IDLE",
            templateOutcomes: previous?.templateOutcomes || [],
            warnings: previous?.warnings || [],
            runMode,
            selectedPhotoOrder,
            photoCursor,
            consumedPhotoIds: previous?.consumedPhotoIds ||
                selectedPhotoOrder.slice(0, photoCursor),
            remainingPhotoIds: previous?.remainingPhotoIds ||
                selectedPhotoOrder.slice(photoCursor)
        });
        this.logOutputRecoverySummary(this.batchRecoverySnapshot);
        this.batchRecoveryClassification = null;
        await this.persistRecoverySnapshot();
    }

    updateRecoveryStage(progress) {
        const current = this.batchRecoverySnapshot;
        if (!current) return;
        this.batchRecoverySnapshot = new BatchRecoverySnapshot({
            ...current,
            batchId: current.batchId,
            currentTemplateId: progress.descriptor?.id ?? null,
            currentTemplateIndex: progress.index,
            lastCompletedStage: progress.stage,
            updatedAt: new Date().toISOString()
        });
        this.batchRecoveryClassification = null;
        this.queueRecoveryWrite();
    }

    updateRecoveryBatch(batch) {
        if (!batch || !this.batchRecoverySnapshot) return;
        const terminalResults = (batch.templateResults || []).filter(
            item => item.status !== "RUNNING"
        );
        // A recovery checkpoint represents only a durable template outcome.
        // Save, export, and document close have all completed before the
        // executor reports a terminal template result.
        if (!terminalResults.length) return;
        const current = this.batchRecoverySnapshot;
        const priorOutcomes = new Map((current.templateOutcomes || []).map(item => [item.templateId, item]));
        terminalResults.forEach(item => {
            const outputTransactions = snapshotTemplateOutputTransactions(item);
            priorOutcomes.set(item.templateId, {
                templateId: item.templateId,
                templateName: item.templateName,
                status: item.status,
                warnings: item.warnings || [],
                error: item.error || null,
                photoAllocation: item.photoAllocation || null,
                // Recovery contains only the detached transaction facts, never
                // service paths, host entries, errors, or document objects.
                outputTransactions,
                outputRetryDisposition: templateOutputRetryDisposition({
                    status: item.status,
                    outputTransactions
                }),
                cancelledAtStage: item.cancelledAtStage || null
            });
        });
        const outcomes = [...priorOutcomes.values()];
        const successful = new Set(current.successfulTemplateIds);
        outcomes.forEach(item => {
            if (item.status === "COMPLETED") successful.add(item.templateId);
            if (item.status === "FAILED") successful.delete(item.templateId);
        });
        const failed = outcomes.filter(item => item.status === "FAILED").map(item => item.templateId);
        const completed = outcomes.filter(item =>
            item.status !== "CANCELLED" || isTemplateOutputCompleteByDefault(item)
        ).map(item => item.templateId);
        const pending = current.queueOrder.filter(id => !completed.includes(id));
        const consumedAllocations = terminalResults.filter(item =>
            item.status === "COMPLETED" || isTemplateOutputCompleteByDefault({
                status: item.status,
                outputTransactions: snapshotTemplateOutputTransactions(item)
            })
        ).map(item => item.photoAllocation).filter(Boolean);
        const photoCursor = consumedAllocations.reduce(
            (cursor, allocation) => Math.max(cursor, allocation.endCursor || 0),
            current.photoCursor || 0
        );
        let lifecycle = batch.status;
        if (batch.status === "CANCELLED") {
            lifecycle = "CANCELLED";
        } else if (batch.status !== "RUNNING" && batch.status !== "FAILED") {
            lifecycle = failed.length ? "COMPLETED_WITH_ERRORS" : (pending.length ? "INTERRUPTED" : "COMPLETED");
        }
        this.batchRecoverySnapshot = new BatchRecoverySnapshot({
            ...current,
            batchId: current.batchId,
            lifecycle,
            updatedAt: new Date().toISOString(),
            completedTemplateIds: completed,
            successfulTemplateIds: [...successful],
            failedTemplateIds: failed,
            pendingTemplateIds: pending,
            currentTemplateId: batch.currentTemplate?.id ?? current.currentTemplateId,
            currentTemplateIndex: batch.templateIndex ?? current.currentTemplateIndex,
            lastCompletedStage: lifecycle === "CANCELLED"
                ? (batch.cancelledAtStage || current.lastCompletedStage)
                : (lifecycle === "FAILED" ? "FAILED" : current.lastCompletedStage),
            templateOutcomes: outcomes,
            warnings: batch.warnings || current.warnings,
            fatalError: batch.fatalError || null,
            cancellationRequestedAt: this.batchCancellationController?.getSnapshot().requestedAt || current.cancellationRequestedAt,
            cancellationEffectiveAt: this.batchCancellationController?.getSnapshot().effectiveAt || current.cancellationEffectiveAt,
            cancellationReason: batch.cancelReason || this.batchCancellationController?.getSnapshot().reason || current.cancellationReason,
            cancelledAtStage: batch.cancelledAtStage || current.cancelledAtStage,
            retainedProgressPercent: batch.retainedProgressPercent || this.batchCancellationController?.getSnapshot().retainedProgressPercent || current.retainedProgressPercent,
            photoCursor,
            consumedPhotoIds: current.selectedPhotoOrder.slice(0, photoCursor),
            remainingPhotoIds: current.selectedPhotoOrder.slice(photoCursor)
        });
        this.logOutputRecoverySummary(this.batchRecoverySnapshot);
        this.batchRecoveryClassification = null;
        this.queueRecoveryWrite();
    }

    logOutputRecoverySummary(snapshot) {
        const outputRecovery = summarizeOutputRecovery(snapshot);
        console.info("ALB045_OUTPUT_RECOVERY_SUMMARY", JSON.stringify({
            committed: outputRecovery.counts.COMMITTED,
            safeRetry: outputRecovery.counts.SAFE_RETRY,
            commitUnknown: outputRecovery.counts.COMMIT_UNKNOWN,
            remediationRequired: outputRecovery.counts.REMEDIATION_REQUIRED,
            automaticRetryTemplates: outputRecovery.automaticRetryTemplates,
            blockedTemplates: outputRecovery.blockedTemplates,
            remediationTemplates: outputRecovery.remediationTemplates
        }));
    }

    markRecoveryFatal(error) {
        const current = this.batchRecoverySnapshot;
        if (!current) return;
        this.batchRecoverySnapshot = new BatchRecoverySnapshot({
            ...current,
            batchId: current.batchId,
            lifecycle: "FAILED",
            lastCompletedStage: "FAILED",
            updatedAt: new Date().toISOString(),
            fatalError: error?.message || "Batch orchestration failed."
        });
        this.batchRecoveryClassification = null;
        this.queueRecoveryWrite();
    }

    queueRecoveryWrite() {
        const generation = this.recoveryWriteGeneration;
        const snapshot = this.batchRecoverySnapshot;
        this.recoveryWritePromise = this.recoveryWritePromise
            .catch(() => null)
            .then(() => {
                if (generation !== this.recoveryWriteGeneration) return null;
                return this.persistRecoverySnapshot(snapshot, generation);
            });
    }

    async persistRecoverySnapshot(
        snapshot = this.batchRecoverySnapshot,
        generation = this.recoveryWriteGeneration
    ) {
        if (!this.project.getProject()) return;
        if (generation !== this.recoveryWriteGeneration) return;
        await this.projectService.saveProject({
            templateRegistry: this.projectTemplateRegistry.toJSON(),
            batchRecovery: this.serializeRecoverySnapshot(snapshot)
        }, { reason: "RECOVERY_CHECKPOINT" });
    }

    serializeRecoverySnapshot(snapshot) {
        if (!snapshot) return null;
        const value = snapshot?.toJSON?.() || snapshot;
        // Return detached plain JSON data. The immutable in-memory snapshot
        // remains untouched while functions/host objects cannot reach disk.
        return JSON.parse(JSON.stringify(value));
    }

    async flushRecoveryWrites() {
        await this.recoveryWritePromise.catch(() => null);
        await this.persistRecoverySnapshot();
    }

    clearProjectExecutionSummary() {

        this.currentProjectExecutionSummary = null;

    }

    async executeReplacementStep(step) {

        const request = this.currentReplacementRequest;
        const requestStep = request?.steps.find(item =>
            item.stepNumber === step?.stepNumber &&
            item.slotLayerId === step?.slotLayerId
        );

        if (!requestStep) {
            const result = this.replacementStepExecutor.result({
                requestId: request?.id ?? null,
                status: "FAILED",
                failedSteps: [{
                    stepNumber: step?.stepNumber ?? null,
                    slotLayerId: step?.slotLayerId ?? null,
                    message: "Replacement request is not ready."
                }],
                errors: ["Replacement request is not ready."],
                startedAt: new Date().toISOString()
            });

            this.replacementStepExecutor.documentManager.sync();

            return result;
        }

        const result = await this.replacementStepExecutor.execute({
            ...requestStep,
            requestId: request.id
        }, this.photoWorkspace.getPhotos());

        this.replacementStepExecutor.documentManager.sync();

        return result;

    }

    getPhotos() {

        return this.photoWorkspace.getPhotos();

    }

    selectedPhotoIds() {

        return this.photoWorkspace.getPhotos()
            .filter(photo => photo?.selected)
            .map(photo => photo.id);

    }

    getPhotoDecisions() {

        return this.photoWorkspace.getPhotoDecisions();

    }

    updatePhotoDecision(photo, values) {

        return this.photoWorkspace.updatePhotoDecision(photo, values);

    }

    getPhotoDuplicateEvidence() {

        return this.photoWorkspace.getPhotoDuplicateEvidence();

    }

    analyzePhotoDuplicates() {

        return this.photoWorkspace.analyzePhotoDuplicates();

    }

    prioritizePhotoThumbnail(photo) {

        this.photoWorkspace.prioritizePhoto(photo);

    }

    setVisiblePhotoThumbnails(photos) {

        this.photoWorkspace.setVisiblePhotos(photos);

    }

    getProjectTemplates() {

        return this.templateDocumentReader.listTemplates();

    }

    getRegisteredProjectTemplates() { return this.projectTemplateRegistry.getAll(); }

    getTemplateRegistryPreflightState() {
        return this.currentTemplateRegistryPreflightState;
    }

    getLastTemplateRegistryPreflightResult() {
        return this.lastTemplateRegistryPreflightResult;
    }

    getTemplateRegistryRecoveryCompatibility() {
        return this.templateRegistryRecoveryCompatibilityService.evaluate({
            descriptors: this.projectTemplateRegistry.getAll(),
            recoverySnapshot: this.batchRecoverySnapshot
        }).recoveryCompatibility;
    }

    getLastTemplateRegistryExecutionGateResult() {
        return this.lastTemplateRegistryExecutionGateResult;
    }

    async revalidateProjectTemplates({ reason = "EXPLICIT_REVALIDATE" } = {}) {
        if (!this.project.getProject()) {
            throw new Error("Open a project before validating templates.");
        }
        return this.validateAndPersistTemplateRegistry({
            reason: this.safeTemplateRegistryPreflightReason(reason)
        });
    }

    async addCurrentPsdToProject(file) {
        if (this.projectBatchRunning || this.registryMutationInProgress) {
            throw new Error("Template registry is currently unavailable.");
        }
        this.registryMutationInProgress = true;
        const rollback = this.captureTemplateRegistryTransaction();
        try {
            const descriptor = this.projectTemplateRegistry.add(file);
            const result = await this.validateAndPersistTemplateRegistry({
                reason: "TEMPLATE_REGISTRY_ADD",
                rollback
            });
            if (!result.persisted) throw this.templateRegistryPersistenceError(result);
            return descriptor;
        } finally {
            this.registryMutationInProgress = false;
        }
    }

    async removeRegisteredProjectTemplate(id) {
        if (this.projectBatchRunning || this.registryMutationInProgress) {
            throw new Error("Template registry is currently unavailable.");
        }
        this.registryMutationInProgress = true;
        const rollback = this.captureTemplateRegistryTransaction();
        try {
            const removed = this.projectTemplateRegistry.remove(id);
            if (removed) {
                const result = await this.validateAndPersistTemplateRegistry({
                    reason: "TEMPLATE_REGISTRY_REMOVE",
                    rollback
                });
                if (!result.persisted) throw this.templateRegistryPersistenceError(result);
            }
            return removed;
        } finally {
            this.registryMutationInProgress = false;
        }
    }

    async validateAndPersistTemplateRegistry({ reason, rollback = null }) {
        const before = rollback || this.captureTemplateRegistryTransaction();
        let workspaceTemplates = [];
        let workspaceAccessError = false;

        try {
            const folder = this.project.getProject()?.workspace?.templates;
            if (!folder || typeof folder.getEntries !== "function") {
                workspaceAccessError = true;
            } else {
                workspaceTemplates = await folder.getEntries();
            }
        } catch (_error) {
            workspaceAccessError = true;
        }

        const validation = this.templateRegistryPreflightService.validate({
            descriptors: this.projectTemplateRegistry.getAll(),
            workspaceTemplates,
            workspaceAccessError
        });
        const observedAt = new Date().toISOString();
        const identityOrOrderChanged =
            !this.projectTemplateRegistry.hasSameIdentityAndOrder(before.registry);
        const applied = this.projectTemplateRegistry.applyValidationResults(validation.results, {
            observedAt
        });
        const proposed = this.templateRegistryPreflightResult(validation.results, {
            persisted: false,
            reason
        });
        this.currentTemplateRegistryPreflightState = proposed;

        if (!identityOrOrderChanged && !applied.changedTemplateIds.length) {
            this.lastTemplateRegistryPreflightResult = proposed;
            return proposed;
        }

        try {
            await this.saveProject(undefined, { reason });
            const committed = Object.freeze({ ...proposed, persisted: true });
            this.currentTemplateRegistryPreflightState = committed;
            this.lastTemplateRegistryPreflightResult = committed;
            return committed;
        } catch (_error) {
            this.restoreTemplateRegistryTransaction(before);
            const failed = Object.freeze({
                ...proposed,
                persisted: false,
                reason: `${reason}_PERSISTENCE_FAILED`
            });
            this.lastTemplateRegistryPreflightResult = failed;
            return failed;
        }
    }

    captureTemplateRegistryTransaction() {
        const project = this.project.getProject();
        return Object.freeze({
            registry: this.projectTemplateRegistry.snapshot(),
            preflightState: this.currentTemplateRegistryPreflightState,
            lastResult: this.lastTemplateRegistryPreflightResult,
            metadata: project ? Object.freeze({ ...project.metadata }) : null
        });
    }

    restoreTemplateRegistryTransaction(snapshot) {
        this.projectTemplateRegistry.restore(snapshot?.registry || []);
        this.currentTemplateRegistryPreflightState = snapshot?.preflightState ||
            this.emptyTemplateRegistryPreflightState();
        this.lastTemplateRegistryPreflightResult = snapshot?.lastResult ||
            this.currentTemplateRegistryPreflightState;
        if (snapshot?.metadata && this.project.getProject()) {
            this.project.updateMetadata(snapshot.metadata);
        }
    }

    templateRegistryPreflightResult(results = [], { persisted, reason }) {
        const count = state => results.filter(result => result.state === state).length;
        const ready = count(TemplateRegistryValidationState.READY);
        const missing = count(TemplateRegistryValidationState.MISSING);
        const ambiguous = count(TemplateRegistryValidationState.AMBIGUOUS);
        const accessError = count(TemplateRegistryValidationState.ACCESS_ERROR);
        return Object.freeze({
            total: results.length,
            ready,
            missing,
            ambiguous,
            accessError,
            blocking: results.length - ready,
            persisted: persisted === true,
            reason
        });
    }

    templateRegistryPreflightStateFromRegistry({ persisted, reason }) {
        const entries = this.projectTemplateRegistry.getAll();
        return this.templateRegistryPreflightResult(entries.map(entry => ({
            state: entry.validationState
        })), { persisted, reason });
    }

    emptyTemplateRegistryPreflightState() {
        return Object.freeze({
            total: 0,
            ready: 0,
            missing: 0,
            ambiguous: 0,
            accessError: 0,
            blocking: 0,
            persisted: false,
            reason: "NOT_VALIDATED"
        });
    }

    templateRegistryPersistenceError(result) {
        const error = new Error("Template registry observations could not be saved.");
        error.code = "TEMPLATE_REGISTRY_PERSISTENCE_FAILED";
        error.result = result;
        return error;
    }

    safeTemplateRegistryPreflightReason(reason) {
        return typeof reason === "string" && /^[A-Z0-9_]{1,64}$/.test(reason)
            ? reason
            : "EXPLICIT_REVALIDATE";
    }

    templateRegistryExecutionCounts(preflight = {}) {
        return Object.freeze({
            total: preflight.total || 0,
            ready: preflight.ready || 0,
            missing: preflight.missing || 0,
            ambiguous: preflight.ambiguous || 0,
            accessError: preflight.accessError || 0,
            blocking: preflight.blocking || 0
        });
    }

    blockTemplateRegistryExecution({
        status,
        preflight,
        blockingReasonCodes,
        recoveryCompatibility = null
    }) {
        const compatibility = recoveryCompatibility ||
            this.getTemplateRegistryRecoveryCompatibility();
        const result = Object.freeze({
            status,
            counts: this.templateRegistryExecutionCounts(preflight),
            blockingReasonCodes: Object.freeze(
                Array.isArray(blockingReasonCodes)
                    ? blockingReasonCodes.slice()
                    : []
            ),
            checkpointCreated: false,
            recoveryMutated: false,
            documentsOpened: 0,
            recoveryCompatibility: compatibility
        });
        this.lastTemplateRegistryExecutionGateResult = result;
        return result;
    }

    async moveRegisteredProjectTemplate(id, targetIndex, method = "drag") {
        const entries = this.projectTemplateRegistry.getAll();
        const previousIndex = entries.findIndex(entry => entry.id === id);
        const template = entries[previousIndex];
        const details = {
            templateId: id,
            templateName: template?.name || "",
            previousIndex,
            nextIndex: targetIndex,
            sourceIndex: previousIndex,
            targetIndex,
            registryCount: entries.length,
            method,
            batchRunning: this.projectBatchRunning,
            mutationRunning: this.registryMutationInProgress,
            persisted: false
        };
        if (this.projectBatchRunning || this.registryMutationInProgress ||
            !template || !Number.isInteger(targetIndex) ||
            targetIndex < 0 || targetIndex >= entries.length ||
            targetIndex === previousIndex) {
            Logger.warn(`TEMPLATE_REORDER_REJECTED ${JSON.stringify(details)}`);
            return false;
        }

        this.registryMutationInProgress = true;
        Logger.info(`TEMPLATE_REORDER_BEGIN ${JSON.stringify(details)}`);
        try {
            const moved = this.projectTemplateRegistry.move(id, targetIndex);
            if (!moved) {
                Logger.warn(`TEMPLATE_REORDER_REJECTED ${JSON.stringify(details)}`);
                return false;
            }
            if (this.batchRecoverySnapshot) this.loadRecovery(this.batchRecoverySnapshot);
            await this.saveProject(undefined, { reason: "TEMPLATE_REGISTRY_REORDER" });
            details.persisted = true;
            Logger.info(`TEMPLATE_REORDER_DONE ${JSON.stringify(details)}`);
            return true;
        } finally {
            this.registryMutationInProgress = false;
        }
    }

    async openTemplateDocument(file) {

        const analysis = await this.templateDocumentReader.read(file);
        const template = new Template(analysis);

        this.clearCurrentPlacementPlan();

        return this.templateRegistry.register(template);

    }

    getCurrentTemplate() {

        return this.templateRegistry.current();

    }

    async closeTemplateDocument() {

        const closed = await this.templateDocumentReader.close();

        if (closed) {
            this.templateRegistry.clear();
            this.clearCurrentPlacementPlan();
        }

        return closed;

    }

    userError(error, fallback) {

        const message = error?.message || "";

        if (message.includes("project")) {
            return "Create or open a project to continue.";
        }

        if (message.includes("photo")) {
            return "No photos are available.";
        }

        if (message.includes("Smart Object") || message.includes("slot")) {
            return "No Smart Object slots are available.";
        }

        if (message.includes("template")) {
            return "No template is open.";
        }

        return fallback;

    }

}

export default new AppController();
