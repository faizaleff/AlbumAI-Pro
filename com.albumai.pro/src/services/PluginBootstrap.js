import Logger from "../core/photoshop/Logger";

export default class PluginBootstrap {

    constructor({

        container,

        eventBus,

        configurationService,

        sessionService,

        statisticsService,

        stateService

    }) {

        this.container = container;
        this.eventBus = eventBus;
        this.configurationService = configurationService;
        this.sessionService = sessionService;
        this.statisticsService = statisticsService;
        this.stateService = stateService;

    }

    async initialize(config = {}) {

        Logger.info(
            "AlbumAI Pro Initializing..."
        );

        this.configurationService.load(config);

        this.stateService.reset();

        this.statisticsService.reset();

        this.sessionService.reset();

        this.eventBus.emit("plugin:initialized");

        Logger.info(
            "AlbumAI Pro Ready."
        );

        return true;

    }

    async shutdown() {

        Logger.info(
            "AlbumAI Pro Shutting Down..."
        );

        this.eventBus.emit("plugin:shutdown");

        this.container.clear();

        this.stateService.reset();

        this.statisticsService.reset();

        this.sessionService.reset();

        Logger.info(
            "Shutdown Complete."
        );

        return true;

    }

}