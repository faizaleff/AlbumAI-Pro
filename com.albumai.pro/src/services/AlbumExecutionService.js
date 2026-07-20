import Logger from "../core/photoshop/Logger";

export default class AlbumExecutionService {

    constructor({

        albumOrchestrator,

        statisticsService,

        performanceMonitor,

        notificationService,

        eventBus

    }) {

        this.albumOrchestrator =
            albumOrchestrator;

        this.statisticsService =
            statisticsService;

        this.performanceMonitor =
            performanceMonitor;

        this.notificationService =
            notificationService;

        this.eventBus =
            eventBus;

    }

    async execute(job) {

        this.performanceMonitor.start();

        this.statisticsService.start();

        this.eventBus.emit(
            "execution:started",
            job
        );

        Logger.info(
            "Album execution started."
        );

        try {

            const result =
                await this.albumOrchestrator.execute(
                    job
                );

            this.statisticsService.finish();

            this.eventBus.emit(
                "execution:completed",
                result
            );

            return result;

        }

        catch (error) {

            this.statisticsService.fail();

            this.notificationService.error(
                error.message
            );

            this.eventBus.emit(
                "execution:failed",
                {
                    job,
                    error
                }
            );

            Logger.error(error);

            throw error;

        }

        finally {

            this.performanceMonitor.stop();

        }

    }

}