import AlbumEngine from "./AlbumEngine";
import AlbumProject from "../album/AlbumProject";

class WorkflowEngine {

    constructor() {

        this.project = null;

        this.running = false;
        this.cancelled = false;

        this.progress = 0;
        this.stage = "Idle";

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

        if (this.running)
            throw new Error("Workflow already running.");

        this.running = true;
        this.cancelled = false;

        try {

            this.updateProgress(0, "Preparing");

            await Promise.resolve();

            if (this.cancelled)
                throw new Error("Workflow cancelled.");

            this.updateProgress(10, "Initializing");

            await Promise.resolve();

            if (this.cancelled)
                throw new Error("Workflow cancelled.");

            this.updateProgress(25, "Analyzing Photos");

            await Promise.resolve();

            if (this.cancelled)
                throw new Error("Workflow cancelled.");

            this.updateProgress(45, "Generating Layout");

            const album = await AlbumEngine.build(
                this.project,
                options
            );

            if (this.cancelled)
                throw new Error("Workflow cancelled.");

            this.updateProgress(80, "Composing Pages");

            await Promise.resolve();

            this.updateProgress(95, "Finalizing");

            await Promise.resolve();

            this.updateProgress(100, "Completed");

            return album;

        }
        finally {

            this.running = false;

        }

    }

    async export() {

        if (!this.project)
            throw new Error("No active project.");

        this.updateProgress(
            this.progress,
            "Exporting"
        );

        await AlbumEngine.export();

        this.updateProgress(
            100,
            "Completed"
        );

    }

    cancel() {

        this.cancelled = true;
        this.running = false;

        this.updateProgress(
            this.progress,
            "Cancelled"
        );

    }

    reset() {

        this.project = null;

        this.running = false;
        this.cancelled = false;

        this.progress = 0;
        this.stage = "Idle";

        AlbumEngine.clear();

    }

    updateProgress(progress, stage) {

        this.progress = progress;
        this.stage = stage;

    }

    getProject() {

        return this.project;

    }

    getStatus() {

        return {

            running: this.running,
            cancelled: this.cancelled,
            progress: this.progress,
            stage: this.stage,
            project: this.project

        };

    }

}

export default new WorkflowEngine();