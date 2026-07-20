import Logger from "./photoshop/Logger";

export default class LifecycleManager {

    constructor({

        plugin,

        eventBus,

        sessionService,

        stateService,

        statisticsService

    }) {

        this.plugin = plugin;

        this.eventBus = eventBus;

        this.sessionService = sessionService;

        this.stateService = stateService;

        this.statisticsService = statisticsService;

    }

    async startup(config = {}) {

        Logger.info(
            "Lifecycle Startup"
        );

        this.statisticsService.reset();

        this.statisticsService.start();

        this.sessionService.start();

        this.stateService.start();

        await this.plugin.start(config);

        this.eventBus.emit(
            "lifecycle:startup"
        );

    }

    async shutdown() {

        Logger.info(
            "Lifecycle Shutdown"
        );

        await this.plugin.stop();

        this.statisticsService.finish();

        this.sessionService.finish();

        this.stateService.complete();

        this.eventBus.emit(
            "lifecycle:shutdown"
        );

    }

    async restart(config = {}) {

        Logger.info(
            "Lifecycle Restart"
        );

        await this.shutdown();

        await this.startup(config);

    }

    async crash(error) {

        Logger.error(error);

        this.stateService.fail(error);

        this.eventBus.emit(
            "lifecycle:crash",
            { error }
        );

    }

}