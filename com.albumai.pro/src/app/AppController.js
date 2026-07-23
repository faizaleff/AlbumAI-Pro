import LibraryEngine from "../core/LibraryEngine";
import SelectionEngine from "../core/SelectionEngine";
import ProjectEngine from "../core/ProjectEngine";
import ProjectService from "../services/ProjectService";
import PhotoWorkspaceService from "../services/PhotoWorkspaceService";
import RecentFilesService from "../services/RecentFilesService";
import TemplateDocumentReader from "../services/TemplateDocumentReader";
import TemplateRegistry from "../services/TemplateRegistry";
import Template from "../templates/Template";
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
import TemplateAutoSaveService, {
    AutoSaveMode
} from "../services/TemplateAutoSaveService";
import TemplateExportService, {
    ExportFormat
} from "../services/TemplateExportService";

export const ExecutionLifecycleStatus = Object.freeze({
    IDLE: "IDLE",
    READY: "READY",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

class AppController {

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
        this.photoPlacementEngine = new PhotoPlacementEngine();
        this.placementExecutionPlanBuilder = new PlacementExecutionPlanBuilder();
        this.currentPlacementPlan = null;
        this.currentPlacementExecutionPlan = null;
        this.currentReplacementRequest = null;
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

    }

    async createProject(options) {

        const project = await this.projectService.createProject(options);

        if (project) {
            this.templateRegistry.clear();
            this.clearCurrentPlacementPlan();
        }

        return project;

    }

    async openProject(folder) {

        const project = await this.projectService.openProject(folder);

        if (project) {
            this.templateRegistry.clear();
            this.clearCurrentPlacementPlan();
        }

        return project;

    }

    saveProject(values) {

        return this.projectService.saveProject(values);

    }

    closeProject() {

        this.templateRegistry.clear();
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

    async executeProject(onUpdate) {

        const project = this.project.getProject();
        const templates = this.templateRegistry.getAll();
        const photos = this.photoWorkspace.getPhotos();
        const startedAt = new Date().toISOString();
        const projectId = project?.metadata?.id ?? project?.metadata?.name ?? null;

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
                status: ProjectExecutionStatus.FAILED
            });

            if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);

            return this.currentProjectExecutionSummary;
        }

        this.currentProjectExecutionSummary = new ProjectExecutionSummary({
            projectId,
            totalTemplates: templates.length,
            completedTemplates: 0,
            failedTemplates: 0,
            templateResults: [],
            startedAt,
            status: ProjectExecutionStatus.RUNNING
        });

        if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);

        this.currentProjectExecutionSummary = await this.projectExecutor.execute({
            project,
            photos,
            autoSaveEnabled: this.autoSaveEnabled,
            autoSaveMode: this.autoSaveMode,
            onAutoSaveResult: result => {
                this.currentAutoSaveResult = result;
            },
            exportEnabled: this.exportEnabled,
            exportFormat: this.exportFormat,
            onExportResult: result => {
                this.currentExportResult = result;
            },
            onProgress: batch => {
                this.currentProjectExecutionSummary = new ProjectExecutionSummary({
                    projectId,
                    totalTemplates: batch.totalTemplates,
                    completedTemplates: batch.completedTemplates,
                    successfulTemplates: batch.successfulTemplates,
                    failedTemplates: batch.failedTemplates,
                    templateResults: batch.templateResults,
                    batchExecution: batch,
                    startedAt: batch.startedAt,
                    elapsedMilliseconds: batch.durationMs,
                    status: ProjectExecutionStatus.RUNNING
                });
                if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);
            }
        });

        if (typeof onUpdate === "function") onUpdate(this.currentProjectExecutionSummary);

        return this.currentProjectExecutionSummary;

    }

    getCurrentProjectExecutionSummary() {

        return this.currentProjectExecutionSummary;

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

    getProjectTemplates() {

        return this.templateDocumentReader.listTemplates();

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
