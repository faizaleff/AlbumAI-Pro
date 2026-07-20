import Logger from "./photoshop/Logger";

export default class Plugin {

    constructor({

        kernel,

        application,

        context,

        configurationService,

        eventBus

    }) {

        this.kernel = kernel;

        this.application = application;

        this.context = context;

        this.configurationService = configurationService;

        this.eventBus = eventBus;

        this.started = false;

    }

    async start(config = {}) {

        if (this.started)
            return;

        Logger.info(
            "AlbumAI Pro Starting..."
        );

        await this.kernel.boot();

        await this.application.initialize(
            config
        );

        this.context.set(
            "startedAt",
            new Date()
        );

        this.eventBus.emit(
            "plugin:start"
        );

        this.started = true;

        Logger.info(
            "AlbumAI Pro Started."
        );

    }

    async stop() {

        if (!this.started)
            return;

        this.eventBus.emit(
            "plugin:stop"
        );

        await this.application.shutdown();

        await this.kernel.shutdown();

        this.context.clear();

        this.started = false;

        Logger.info(
            "AlbumAI Pro Stopped."
        );

    }

    async restart(config = {}) {

        await this.stop();

        await this.start(config);

    }

    isRunning() {

        return this.started;

    }

}