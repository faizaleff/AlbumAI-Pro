import Logger from "../core/photoshop/Logger";

export default class AlbumService {

    constructor({

        albumManager,

        eventBus,

        notificationService,

        recentFilesService,

        statisticsService

    }) {

        this.albumManager =
            albumManager;

        this.eventBus =
            eventBus;

        this.notificationService =
            notificationService;

        this.recentFilesService =
            recentFilesService;

        this.statisticsService =
            statisticsService;

    }

    async create(job) {

        Logger.info(
            "Creating album..."
        );

        this.eventBus.emit(
            "album:create:start",
            job
        );

        try {

            const result =
                await this.albumManager.generate(
                    job
                );

            if (job.outputFolder) {

                this.recentFilesService.add(
                    job.outputFolder
                );

            }

            this.notificationService.success(
                "Album created successfully."
            );

            this.eventBus.emit(
                "album:create:completed",
                result
            );

            return result;

        }

        catch (error) {

            this.notificationService.error(
                error.message
            );

            this.eventBus.emit(
                "album:create:failed",
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

        this.albumManager.cancel();

    }

    getState() {

        return this.albumManager.getState();

    }

    getStatistics() {

        return this.statisticsService.summary();

    }

}