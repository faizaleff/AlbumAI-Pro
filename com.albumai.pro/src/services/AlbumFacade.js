import Logger from "../core/photoshop/Logger";

export default class AlbumFacade {

    constructor({

        albumService,

        configurationService,

        notificationService,

        stateService,

        eventBus

    }) {

        this.albumService =
            albumService;

        this.configurationService =
            configurationService;

        this.notificationService =
            notificationService;

        this.stateService =
            stateService;

        this.eventBus =
            eventBus;

    }

    async create(job) {

        Logger.info(
            "AlbumFacade.create()"
        );

        this.eventBus.emit(
            "facade:create:start",
            job
        );

        try {

            const result =
                await this.albumService.create(
                    job
                );

            this.eventBus.emit(
                "facade:create:completed",
                result
            );

            return result;

        }

        catch (error) {

            this.notificationService.error(
                error.message
            );

            this.eventBus.emit(
                "facade:create:failed",
                {
                    job,
                    error
                }
            );

            throw error;

        }

    }

    cancel() {

        this.albumService.cancel();

    }

    state() {

        return this.stateService.getState();

    }

    configuration() {

        return this.configurationService.all();

    }

}