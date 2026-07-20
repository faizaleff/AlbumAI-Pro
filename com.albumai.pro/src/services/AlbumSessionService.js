import Logger from "../core/photoshop/Logger";

export default class AlbumSessionService {

    constructor({

        sessionService,

        statisticsService,

        stateService,

        configurationService

    }) {

        this.sessionService =
            sessionService;

        this.statisticsService =
            statisticsService;

        this.stateService =
            stateService;

        this.configurationService =
            configurationService;

    }

    start(data = {}) {

        this.stateService.start();

        this.statisticsService.reset();

        this.statisticsService.start();

        const id =
            this.sessionService.start({

                configuration:

                    this.configurationService.all(),

                ...data

            });

        Logger.info(

            `Album Session Started : ${id}`

        );

        return id;

    }

    finish() {

        this.statisticsService.finish();

        this.stateService.complete();

        const summary =
            this.sessionService.finish();

        Logger.info(
            "Album Session Finished."
        );

        return {

            summary,

            statistics:

                this.statisticsService.summary()

        };

    }

    cancel() {

        this.stateService.cancel();

        this.sessionService.cancel();

        Logger.warn(
            "Album Session Cancelled."
        );

    }

    fail(error) {

        this.stateService.fail(error);

        Logger.error(error);

    }

    current() {

        return this.sessionService.summary();

    }

}