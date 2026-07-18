import WorkflowEngine from "./WorkflowEngine";

class AutoAlbumEngine {

    constructor() {

        this.running = false;

    }

    async generate({

        name = "New Album",
        folder = null,
        photos = [],
        template = null,
        options = {}

    } = {}) {

        if (this.running) {
            throw new Error("Album generation already running.");
        }

        this.running = true;

        try {

            await WorkflowEngine.createProject({

                name,
                folder,
                photos,
                template

            });

            return await WorkflowEngine.run(options);

        } finally {

            this.running = false;

        }

    }

    async regenerate(options = {}) {

        if (this.running) {
            throw new Error("Album generation already running.");
        }

        const project = WorkflowEngine.getProject();

        if (!project) {
            throw new Error("No active project.");
        }

        this.running = true;

        try {

            return await WorkflowEngine.run(options);

        } finally {

            this.running = false;

        }

    }

    async export() {

        return WorkflowEngine.export();

    }

    cancel() {

        WorkflowEngine.cancel();
        this.running = false;

    }

    reset() {

        WorkflowEngine.reset();
        this.running = false;

    }

    status() {

        return WorkflowEngine.getStatus();

    }

    isRunning() {

        return this.running;

    }

    progress() {

        const status = this.status();

        return status?.progress ?? 0;

    }

    stage() {

        const status = this.status();

        return status?.stage ?? "";

    }

    project() {

        return WorkflowEngine.getProject();

    }

}

export default new AutoAlbumEngine();