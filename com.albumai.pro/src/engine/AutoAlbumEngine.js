import WorkflowEngine from "./WorkflowEngine";

class AutoAlbumEngine {

    async generate({

        name = "New Album",

        folder = null,

        photos = [],

        template = null,

        options = {}

    } = {}) {

        await WorkflowEngine.createProject({

            name,

            folder,

            photos,

            template

        });

        return WorkflowEngine.run(options);

    }

    async regenerate(options = {}) {

        const project = WorkflowEngine.getProject();

        if (!project)
            throw new Error("No active project.");

        return WorkflowEngine.run(options);

    }

    async export() {

        return WorkflowEngine.export();

    }

    cancel() {

        WorkflowEngine.cancel();

    }

    reset() {

        WorkflowEngine.reset();

    }

    status() {

        return WorkflowEngine.getStatus();

    }

    isRunning() {

        return this.status().running;

    }

    progress() {

        return this.status().progress;

    }

    stage() {

        return this.status().stage;

    }

    project() {

        return WorkflowEngine.getProject();

    }

}

export default new AutoAlbumEngine();