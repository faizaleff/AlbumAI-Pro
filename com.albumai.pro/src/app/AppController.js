import LibraryEngine from "../core/LibraryEngine";
import SelectionEngine from "../core/SelectionEngine";
import ProjectEngine from "../core/ProjectEngine";
import ProjectService from "../services/ProjectService";
import RecentFilesService from "../services/RecentFilesService";

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

    }

    createProject(options) {

        return this.projectService.createProject(options);

    }

    openProject(folder) {

        return this.projectService.openProject(folder);

    }

    saveProject(values) {

        return this.projectService.saveProject(values);

    }

    closeProject() {

        return this.projectService.closeProject();

    }

    getRecentProjects() {

        return this.projectService.getRecentProjects();

    }

}

export default new AppController();
