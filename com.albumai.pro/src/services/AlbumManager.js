import Logger from "../core/photoshop/Logger";

export default class AlbumManager {

    constructor({

        albumExecutionService,

        stateService,

        eventBus,

        configurationService,

        notificationService

    }) {

        this.albumExecutionService =
            albumExecutionService;

        this.stateService =
            stateService;

        this.eventBus =
            eventBus;

        this.configurationService =
            configurationService;

        this.notificationService =
            notificationService;

    }

    async generate(job) {

        this.stateService.setState("running");

        this.eventBus.emit(
            "album:generate:start",
            job
        );

        Logger.info(
            "Album generation started."
        );

        try {

            const result =
                await this.albumExecutionService.execute(
                    job
                );

            this.stateService.setState(
                "completed"
            );

            this.eventBus.emit(
                "album:generate:completed",
                result
            );

            return result;

        }

        catch (error) {

            this.stateService.setState(
                "failed"
            );

            this.notificationService.error(
                error.message
            );

            this.eventBus.emit(
                "album:generate:failed",
                {
                    job,
                    error
                }
            );

            Logger.error(error);

            throw error;

        }

    }

    cancel() {

        this.stateService.setState(
            "cancelled"
        );

        this.eventBus.emit(
            "album:generate:cancelled"
        );

        Logger.warn(
            "Album generation cancelled."
        );

    }

    getState() {

        return this.stateService.getState();

    }

    getConfiguration() {

        return this.configurationService.all();

    }

}