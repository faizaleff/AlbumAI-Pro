import Logger from "./photoshop/Logger";

export default class Application {

    constructor({

        bootstrap,

        generationController,

        eventBus,

        configurationService

    }) {

        this.bootstrap = bootstrap;

        this.generationController =
            generationController;

        this.eventBus = eventBus;

        this.configurationService =
            configurationService;

        this.initialized = false;

    }

    async initialize(config = {}) {

        if (this.initialized)
            return;

        await this.bootstrap.initialize(config);

        this.registerEvents();

        this.initialized = true;

        Logger.info(
            "Application Initialized."
        );

    }

    registerEvents() {

        this.eventBus.on(

            "generation:start",

            options => {

                this.generate(options);

            }

        );

    }

    async generate(options) {

        return await this.generationController.generate(
            options
        );

    }

    async generateQueue(tasks) {

        return await this.generationController.generateQueue(
            tasks
        );

    }

    async shutdown() {

        await this.bootstrap.shutdown();

        this.initialized = false;

    }

}