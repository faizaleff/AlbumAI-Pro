import Logger from "../core/photoshop/Logger";

export default class StateService {

    constructor() {

        this.reset();

    }

    reset() {

        this.state = {

            idle: true,

            running: false,

            paused: false,

            cancelled: false,

            completed: false,

            error: null

        };

    }

    start() {

        this.state.idle = false;
        this.state.running = true;
        this.state.paused = false;
        this.state.cancelled = false;
        this.state.completed = false;
        this.state.error = null;

        Logger.info("Generation started.");

    }

    pause() {

        this.state.running = false;
        this.state.paused = true;

        Logger.info("Generation paused.");

    }

    resume() {

        this.state.running = true;
        this.state.paused = false;

        Logger.info("Generation resumed.");

    }

    cancel() {

        this.state.running = false;
        this.state.cancelled = true;

        Logger.warn("Generation cancelled.");

    }

    complete() {

        this.state.running = false;
        this.state.completed = true;

        Logger.info("Generation completed.");

    }

    fail(error) {

        this.state.running = false;
        this.state.error = error;

        Logger.error(error);

    }

    isIdle() {

        return this.state.idle;

    }

    isRunning() {

        return this.state.running;

    }

    isPaused() {

        return this.state.paused;

    }

    isCancelled() {

        return this.state.cancelled;

    }

    isCompleted() {

        return this.state.completed;

    }

    hasError() {

        return this.state.error !== null;

    }

    getError() {

        return this.state.error;

    }

    getState() {

        return {

            ...this.state

        };

    }

}