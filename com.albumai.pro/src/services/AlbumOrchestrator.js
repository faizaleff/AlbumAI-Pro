import Logger from "../core/photoshop/Logger";

export default class AlbumOrchestrator {

    constructor({

        albumRuntime,

        queueManager,

        jobManager,

        eventBus,

        notificationService

    }) {

        this.albumRuntime =
            albumRuntime;

        this.queueManager =
            queueManager;

        this.jobManager =
            jobManager;

        this.eventBus =
            eventBus;

        this.notificationService =
            notificationService;

    }

    async execute(job) {

        this.jobManager.start(job);

        this.queueManager.enqueue(job);

        this.eventBus.emit(
            "album:started",
            job
        );

        try {

            const result =
                await this.albumRuntime.run(job);

            this.jobManager.complete(
                job.id,
                result
            );

            this.queueManager.dequeue();

            this.notificationService.success(
                "Album completed successfully."
            );

            this.eventBus.emit(
                "album:completed",
                result
            );

            return result;

        }

        catch (error) {

            this.jobManager.fail(
                job.id,
                error
            );

            this.queueManager.dequeue();

            this.notificationService.error(
                error.message
            );

            this.eventBus.emit(
                "album:failed",
                {
                    job,
                    error
                }
            );

            Logger.error(error);

            throw error;

        }

    }

}