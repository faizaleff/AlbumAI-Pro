import Logger from "../core/photoshop/Logger";

export default class SessionService {

    constructor() {

        this.reset();

    }

    start(data = {}) {

        this.id =
            `session_${Date.now()}`;

        this.startedAt =
            new Date();

        this.active = true;

        this.data = {
            ...data
        };

        Logger.info(
            `Session started (${this.id})`
        );

        return this.id;

    }

    finish() {

        this.endedAt =
            new Date();

        this.active = false;

        Logger.info(
            `Session finished (${this.id})`
        );

        return this.summary();

    }

    cancel() {

        this.active = false;

        Logger.warn(
            `Session cancelled (${this.id})`
        );

    }

    set(key, value) {

        this.data[key] = value;

    }

    get(key) {

        return this.data[key];

    }

    has(key) {

        return Object.prototype.hasOwnProperty.call(
            this.data,
            key
        );

    }

    remove(key) {

        delete this.data[key];

    }

    summary() {

        return {

            id: this.id,

            active: this.active,

            startedAt: this.startedAt,

            endedAt: this.endedAt,

            duration:

                this.startedAt && this.endedAt

                    ? this.endedAt - this.startedAt

                    : 0,

            data: {

                ...this.data

            }

        };

    }

    reset() {

        this.id = null;

        this.startedAt = null;

        this.endedAt = null;

        this.active = false;

        this.data = {};

    }

}