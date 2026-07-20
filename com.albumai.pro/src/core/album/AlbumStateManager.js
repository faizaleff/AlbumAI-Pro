import Logger from "../photoshop/Logger";
import AlbumStateMachine from "./AlbumStateMachine";

export default class AlbumStateManager {

    constructor() {

        this.machine =
            new AlbumStateMachine();

    }

    initialize() {

        this.machine.transition(

            this.machine.states().READY

        );

    }

    start() {

        this.machine.transition(

            this.machine.states().RUNNING

        );

    }

    pause() {

        this.machine.transition(

            this.machine.states().PAUSED

        );

    }

    resume() {

        this.machine.transition(

            this.machine.states().RUNNING

        );

    }

    complete() {

        this.machine.transition(

            this.machine.states().COMPLETED

        );

        Logger.info(
            "Album generation completed."
        );

    }

    cancel() {

        this.machine.transition(

            this.machine.states().CANCELLED

        );

        Logger.warn(
            "Album generation cancelled."
        );

    }

    fail(error) {

        this.machine.transition(

            this.machine.states().FAILED

        );

        Logger.error(error);

    }

    reset() {

        this.machine.reset();

    }

    current() {

        return this.machine.current();

    }

    previous() {

        return this.machine.previous();

    }

    isRunning() {

        return this.machine.isRunning();

    }

    isReady() {

        return this.machine.isReady();

    }

    isPaused() {

        return this.machine.isPaused();

    }

    isCompleted() {

        return this.machine.isCompleted();

    }

    isCancelled() {

        return this.machine.isCancelled();

    }

    isFailed() {

        return this.machine.isFailed();

    }

}