import Logger from "../photoshop/Logger";
import AlbumStateManager from "./AlbumStateManager";
import AlbumSessionManager from "./AlbumSessionManager";
import AlbumStatisticsManager from "./AlbumStatisticsManager";
import AlbumHealthService from "./AlbumHealthService";

export default class AlbumLifecycleManager {

    constructor({

        stateManager = new AlbumStateManager(),

        sessionManager = new AlbumSessionManager(),

        statisticsManager = new AlbumStatisticsManager(),

        healthService = new AlbumHealthService()

    } = {}) {

        this.stateManager = stateManager;
        this.sessionManager = sessionManager;
        this.statisticsManager = statisticsManager;
        this.healthService = healthService;

    }

    initialize() {

        this.stateManager.initialize();

        this.healthService.start();

        Logger.info(
            "Album lifecycle initialized."
        );

    }

    start(session = {}) {

        this.stateManager.start();

        this.sessionManager.start(session);

        this.statisticsManager.start();

        Logger.info(
            "Album lifecycle started."
        );

    }

    pause() {

        this.stateManager.pause();

        Logger.info(
            "Album lifecycle paused."
        );

    }

    resume() {

        this.stateManager.resume();

        Logger.info(
            "Album lifecycle resumed."
        );

    }

    complete() {

        this.statisticsManager.finish();

        this.sessionManager.finish();

        this.stateManager.complete();

        Logger.info(
            "Album lifecycle completed."
        );

    }

    fail(error) {

        this.sessionManager.fail(error);

        this.healthService.error(

            error?.message || String(error)

        );

        this.stateManager.fail(error);

    }

    cancel() {

        this.sessionManager.cancel();

        this.stateManager.cancel();

        Logger.warn(
            "Album lifecycle cancelled."
        );

    }

    reset() {

        this.sessionManager.reset();

        this.statisticsManager.reset();

        this.healthService.reset();

        this.stateManager.reset();

        Logger.info(
            "Album lifecycle reset."
        );

    }

    status() {

        return {

            state:

                this.stateManager.current(),

            session:

                this.sessionManager.current(),

            statistics:

                this.statisticsManager.export(),

            health:

                this.healthService.status()

        };

    }

}
