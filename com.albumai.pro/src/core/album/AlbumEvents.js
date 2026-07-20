import Logger from "../photoshop/Logger";

export default class AlbumEvents {

    constructor() {

        this.listeners = new Map();

    }

    on(event, callback) {

        if (!this.listeners.has(event)) {

            this.listeners.set(event, []);

        }

        this.listeners
            .get(event)
            .push(callback);

        return callback;

    }

    once(event, callback) {

        const wrapper = (...args) => {

            this.off(event, wrapper);

            callback(...args);

        };

        return this.on(event, wrapper);

    }

    off(event, callback) {

        if (!this.listeners.has(event)) {

            return;

        }

        const handlers =

            this.listeners.get(event);

        this.listeners.set(

            event,

            handlers.filter(

                handler => handler !== callback

            )

        );

    }

    emit(event, ...args) {

        if (!this.listeners.has(event)) {

            return;

        }

        Logger.info(

            `Event emitted: ${event}`

        );

        for (const handler of this.listeners.get(event)) {

            try {

                handler(...args);

            }
            catch (error) {

                Logger.error(error);

            }

        }

    }

    clear(event = null) {

        if (event) {

            this.listeners.delete(event);

            return;

        }

        this.listeners.clear();

    }

    listenerCount(event) {

        return this.listeners.has(event)

            ? this.listeners.get(event).length

            : 0;

    }

    events() {

        return [

            ...this.listeners.keys()

        ];

    }

}