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
import ExecutionSummary, { ExecutionStatus } from "../placement/ExecutionSummary";
import BatchProgress from "../placement/BatchProgress";
import Logger from "../core/photoshop/Logger";

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

    }

    async createProject(options) {

        const project = await this.projectService.createProject(options);

        if (project) {
            this.clearCurrentPlacementPlan();
        }

        return project;

    }

    async openProject(folder) {

        const project = await this.projectService.openProject(folder);

        if (project) {
            this.clearCurrentPlacementPlan();
        }

        return project;

    }

    saveProject(values) {

        return this.projectService.saveProject(values);

    }

    closeProject() {

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

        const placement = this.photoPlacementEngine.plan({
            project: this.project.getProject(),
            photos: this.photoWorkspace.getPhotos(),
            template: this.templateRegistry.current(),
            options
        });

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

    }

    buildPlacementExecutionPlan() {

        const executionPlan = this.placementExecutionPlanBuilder.build({
            placementResult: this.currentPlacementPlan,
            project: this.project.getProject(),
            template: this.templateRegistry.current(),
            photos: this.photoWorkspace.getPhotos()
        });

        this.currentPlacementExecutionPlan = executionPlan;
        this.clearCurrentReplacementRequest();
        this.buildReplacementRequest();

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

    }

    async executeReplacementBatch(onProgress) {

        const project = this.project.getProject();
        const request = this.currentReplacementRequest;

        if (!project || !request || !Array.isArray(request.steps) || !request.steps.length) {
            const startedAt = new Date().toISOString();
            this.currentExecutionSummary = new ExecutionSummary({
                requestId: request?.id ?? null,
                totalSteps: Array.isArray(request?.steps) ? request.steps.length : 0,
                completedSteps: 0,
                failedSteps: 0,
                skippedSteps: Array.isArray(request?.steps) ? request.steps.length : 0,
                results: [],
                startedAt,
                finishedAt: startedAt,
                elapsedMilliseconds: 0,
                status: ExecutionStatus.FAILED
            });

            return this.currentExecutionSummary;
        }

        this.currentExecutionSummary = await this.replacementBatchExecutor.execute(
            request,
            {
                photos: this.photoWorkspace.getPhotos(),
                templateName: this.templateRegistry.current()?.name || "",
                onProgress: progress => {
                    this.currentBatchProgress = progress;

                    if (typeof onProgress === "function") {
                        onProgress(progress);
                    }
                }
            }
        );

        this.replacementStepExecutor.documentManager.sync();

        return this.currentExecutionSummary;

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

    async executeReplacementStep(step) {

        Logger.info("Replacement trace: AppController.executeReplacementStep before executor");

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
                    message: "Replacement step is not part of the current request."
                }],
                errors: ["Replacement step is not part of the current request."],
                startedAt: new Date().toISOString()
            });

            this.replacementStepExecutor.documentManager.sync();

            return result;
        }

        const result = await this.replacementStepExecutor.execute({
            ...requestStep,
            requestId: request.id
        }, this.photoWorkspace.getPhotos());

        Logger.info("Replacement trace: AppController.executeReplacementStep after executor");

        Logger.info("Replacement trace: AppController before DocumentManager.sync");
        this.replacementStepExecutor.documentManager.sync();
        Logger.info("Replacement trace: AppController after DocumentManager.sync");

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

}

export default new AppController();
