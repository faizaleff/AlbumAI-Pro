// src/services/ProgressReporter.js

class ProgressReporter {

    constructor() {

        this.listeners = new Set();

        this.current = {

            stage: "",

            message: "",

            current: 0,

            total: 0,

            percentage: 0,

            completed: false

        };

    }

    /**
     * Subscribe to progress updates.
     */
    subscribe(listener) {

        this.listeners.add(listener);

        listener(this.current);

        return () => this.unsubscribe(listener);

    }

    /**
     * Remove listener.
     */
    unsubscribe(listener) {

        this.listeners.delete(listener);

    }

    /**
     * Set current stage.
     */
    stage(stage, message = "") {

        this.current.stage = stage;
        this.current.message = message;

        this.notify();

    }

    /**
     * Update numeric progress.
     */
    update(current, total, message = "") {

        this.current.current = current;
        this.current.total = total;
        this.current.message = message;

        this.current.percentage =

            total === 0
                ? 0
                : Math.round((current / total) * 100);

        this.notify();

    }

    /**
     * Mark generation complete.
     */
    complete(message = "Completed") {

        this.current.completed = true;

        this.current.message = message;

        this.current.current = this.current.total;

        this.current.percentage = 100;

        this.notify();

    }

    /**
     * Reset reporter.
     */
    reset() {

        this.current = {

            stage: "",

            message: "",

            current: 0,

            total: 0,

            percentage: 0,

            completed: false

        };

        this.notify();

    }

    /**
     * Snapshot.
     */
    snapshot() {

        return {

            ...this.current

        };

    }

    /**
     * Notify subscribers.
     */
    notify() {

        for (const listener of this.listeners) {

            listener({

                ...this.current

            });

        }

    }

}

export default ProgressReporter;