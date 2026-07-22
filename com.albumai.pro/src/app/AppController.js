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
import ReplacementStepExecutor from "../placement/ReplacementStepExecutor";

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

}

export default new AppController();
