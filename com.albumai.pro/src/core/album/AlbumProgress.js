// src/core/album/AlbumProgress.js

class AlbumProgress {

    constructor() {

        this.listeners = new Map();

        this.state = {

            jobId: null,

            stage: "idle",

            current: 0,

            total: 0,

            percentage: 0,

            message: ""

        };

    }

    /**
     * Subscribe to progress events.
     */
    on(event, callback) {

        if (!this.listeners.has(event)) {

            this.listeners.set(event, []);

        }

        this.listeners.get(event).push(callback);

    }

    /**
     * Remove listener.
     */
    off(event, callback) {

        if (!this.listeners.has(event))
            return;

        this.listeners.set(

            event,

            this.listeners
                .get(event)
                .filter(fn => fn !== callback)

        );

    }

    /**
     * Emit event.
     */
    emit(event, payload) {

        if (!this.listeners.has(event))
            return;

        for (const listener of this.listeners.get(event)) {

            listener(payload);

        }

    }

    /**
     * Update progress.
     */
    update({

        jobId,

        stage,

        current,

        total,

        message = ""

    }) {

        const percentage =

            total === 0
                ? 0
                : Math.round((current / total) * 100);

        this.state = {

            jobId,

            stage,

            current,

            total,

            percentage,

            message

        };

        this.emit("progress", this.state);

    }

    /**
     * Finish.
     */
    complete(jobId) {

        this.update({

            jobId,

            stage: "completed",

            current: 100,

            total: 100,

            message: "Album completed."

        });

        this.emit("completed", this.state);

    }

    /**
     * Error.
     */
    error(jobId, error) {

        this.emit("error", {

            jobId,

            error

        });

    }

    /**
     * Current state.
     */
    getState() {

        return {

            ...this.state

        };

    }

    /**
     * Reset.
     */
    reset() {

        this.state = {

            jobId: null,

            stage: "idle",

            current: 0,

            total: 0,

            percentage: 0,

            message: ""

        };

    }

}

export default AlbumProgress;