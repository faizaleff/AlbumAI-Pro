import Logger from "../core/photoshop/Logger";

export default class AlbumEngine {

    constructor({

        albumWorkflowService,

        healthMonitor,

        performanceMonitor,

        memoryManager,

        configurationService

    }) {

        this.albumWorkflowService =
            albumWorkflowService;

        this.healthMonitor =
            healthMonitor;

        this.performanceMonitor =
            performanceMonitor;

        this.memoryManager =
            memoryManager;

        this.configurationService =
            configurationService;

        this.running = false;

    }

    async start(options) {

        if (this.running) {

            throw new Error(
                "Album Engine is already running."
            );

        }

        this.running = true;

        this.performanceMonitor.start();

        this.healthMonitor.start();

        Logger.info(
            "Album Engine Started."
        );

        try {

            const result =
                await this.albumWorkflowService.execute(
                    options
                );

            return result;

        }

        finally {

            await this.stop();

        }

    }

    async stop() {

        if (!this.running)
            return;

        this.performanceMonitor.stop();

        this.healthMonitor.stop();

        await this.memoryManager.cleanup();

        this.running = false;

        Logger.info(
            "Album Engine Stopped."
        );

    }

    isRunning() {

        return this.running;

    }

    getConfiguration() {

        return this.configurationService.all();

    }

}