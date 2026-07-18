import AlbumEngine from "./AlbumEngine";
import AlbumProject from "../album/AlbumProject";

class WorkflowEngine {

    constructor() {

        this.project = null;

        this.running = false;

        this.progress = 0;

        this.stage = "idle";

    }

    async createProject(config = {}) {

        this.project = new AlbumProject();

        if (config.name)
            this.project.setName(config.name);

        if (config.folder)
            this.project.setFolder(config.folder);

        if (config.photos)
            this.project.setPhotos(config.photos);

        if (config.template)
            this.project.setTemplate(config.template);

        return this.project;

    }

    async run(options = {}) {

        if (!this.project)
            throw new Error("Project not created.");

        this.running = true;

        this.progress = 0;

        this.stage = "Analyzing";

        this.progress = 25;

        const album =
            await AlbumEngine.build(
                this.project,
                options
            );

        this.stage = "Composing";

        this.progress = 75;

        this.stage = "Completed";

        this.progress = 100;

        this.running = false;

        return album;

    }

    async export() {

        this.stage = "Exporting";

        await AlbumEngine.export();

        this.stage = "Completed";

    }

    cancel() {

        this.running = false;

        this.stage = "Cancelled";

    }

    reset() {

        this.running = false;

        this.progress = 0;

        this.stage = "Idle";

        this.project = null;

        AlbumEngine.clear();

    }

    getProject() {

        return this.project;

    }

    getStatus() {

        return {

            running: this.running,

            progress: this.progress,

            stage: this.stage,

            project: !!this.project

        };

    }

}

export default new WorkflowEngine();