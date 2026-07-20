import Logger from "../photoshop/Logger";

export default class AlbumSession {

    constructor() {

        this.reset();

    }

    start(data = {}) {

        this.session = {

            id: crypto.randomUUID(),

            startedAt: new Date(),

            endedAt: null,

            status: "running",

            processedPhotos: 0,

            totalPhotos: 0,

            ...data

        };

        Logger.info(

            `Session started: ${this.session.id}`

        );

        return this.session;

    }

    update(values = {}) {

        if (!this.session) {

            throw new Error(
                "No active session."
            );

        }

        Object.assign(

            this.session,

            values

        );

        return this.session;

    }

    incrementProcessed(count = 1) {

        if (!this.session) {

            return;

        }

        this.session.processedPhotos += count;

    }

    finish() {

        if (!this.session) {

            return null;

        }

        this.session.status = "completed";

        this.session.endedAt = new Date();

        Logger.info(

            `Session completed: ${this.session.id}`

        );

        return this.session;

    }

    fail(error) {

        if (!this.session) {

            return;

        }

        this.session.status = "failed";

        this.session.error =

            error?.message || String(error);

        this.session.endedAt = new Date();

        Logger.error(error);

    }

    cancel() {

        if (!this.session) {

            return;

        }

        this.session.status = "cancelled";

        this.session.endedAt = new Date();

        Logger.warn(

            `Session cancelled: ${this.session.id}`

        );

    }

    get() {

        return this.session;

    }

    reset() {

        this.session = null;

    }

}