import Logger from "../photoshop/Logger";

const STATES = Object.freeze({

    IDLE: "idle",

    READY: "ready",

    RUNNING: "running",

    PAUSED: "paused",

    COMPLETED: "completed",

    CANCELLED: "cancelled",

    FAILED: "failed"

});

export default class AlbumStateMachine {

    constructor() {

        this.state = STATES.IDLE;

        this.previousState = null;

    }

    transition(nextState) {

        if (!Object.values(STATES).includes(nextState)) {

            throw new Error(

                `Invalid state: ${nextState}`

            );

        }

        this.previousState = this.state;

        this.state = nextState;

        Logger.info(

            `${this.previousState} -> ${this.state}`

        );

    }

    reset() {

        this.previousState = this.state;

        this.state = STATES.IDLE;

    }

    current() {

        return this.state;

    }

    previous() {

        return this.previousState;

    }

    isIdle() {

        return this.state === STATES.IDLE;

    }

    isReady() {

        return this.state === STATES.READY;

    }

    isRunning() {

        return this.state === STATES.RUNNING;

    }

    isPaused() {

        return this.state === STATES.PAUSED;

    }

    isCompleted() {

        return this.state === STATES.COMPLETED;

    }

    isCancelled() {

        return this.state === STATES.CANCELLED;

    }

    isFailed() {

        return this.state === STATES.FAILED;

    }

    states() {

        return STATES;

    }

}