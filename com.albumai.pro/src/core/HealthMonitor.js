import Logger from "./photoshop/Logger";

export default class HealthMonitor {

    constructor({

        eventBus,

        stateService,

        statisticsService,

        sessionService

    }) {

        this.eventBus = eventBus;

        this.stateService = stateService;

        this.statisticsService = statisticsService;

        this.sessionService = sessionService;

        this.lastCheck = null;

    }

    check() {

        this.lastCheck = new Date();

        const report = {

            timestamp: this.lastCheck,

            running:

                this.stateService.isRunning(),

            completed:

                this.stateService.isCompleted(),

            cancelled:

                this.stateService.isCancelled(),

            error:

                this.stateService.getError(),

            statistics:

                this.statisticsService.summary(),

            session:

                this.sessionService.summary()

        };

        this.eventBus.emit(

            "health:checked",

            report

        );

        Logger.info(

            "Health check completed."

        );

        return report;

    }

    heartbeat() {

        const heartbeat = {

            time: new Date(),

            running:

                this.stateService.isRunning()

        };

        this.eventBus.emit(

            "health:heartbeat",

            heartbeat

        );

        return heartbeat;

    }

    isHealthy() {

        return (

            !this.stateService.hasError()

        );

    }

}