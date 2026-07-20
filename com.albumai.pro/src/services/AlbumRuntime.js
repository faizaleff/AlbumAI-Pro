import Logger from "../core/photoshop/Logger";

export default class AlbumRuntime {

    constructor({

        albumEngine,

        dependencyContainer,

        applicationContext,

        eventBus

    }) {

        this.albumEngine =
            albumEngine;

        this.dependencyContainer =
            dependencyContainer;

        this.applicationContext =
            applicationContext;

        this.eventBus =
            eventBus;

        this.initialized = false;

    }

    async initialize() {

        if (this.initialized)
            return;

        await this.dependencyContainer.initialize();

        this.applicationContext.set(
            "runtimeStarted",
            new Date()
        );

        this.initialized = true;

        this.eventBus.emit(
            "runtime:initialized"
        );

        Logger.info(
            "Album Runtime Initialized."
        );

    }

    async run(options) {

        if (!this.initialized) {

            await this.initialize();

        }

        this.eventBus.emit(
            "runtime:started",
            options
        );

        return await this.albumEngine.start(
            options
        );

    }

    async shutdown() {

        if (!this.initialized)
            return;

        await this.albumEngine.stop();

        this.applicationContext.clear();

        this.eventBus.emit(
            "runtime:shutdown"
        );

        this.initialized = false;

        Logger.info(
            "Album Runtime Shutdown."

        );

    }

    isInitialized() {

        return this.initialized;

    }

}