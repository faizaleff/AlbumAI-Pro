import Logger from "../core/photoshop/Logger";

export default class EventBus {

    constructor() {

        this.events = new Map();

    }

    on(event, callback) {

        if (!this.events.has(event)) {

            this.events.set(event, []);

        }

        this.events.get(event).push(callback);

    }

    once(event, callback) {

        const wrapper = (data) => {

            this.off(event, wrapper);

            callback(data);

        };

        this.on(event, wrapper);

    }

    off(event, callback) {

        if (!this.events.has(event))
            return;

        const listeners =
            this.events.get(event);

        this.events.set(

            event,

            listeners.filter(
                listener => listener !== callback
            )

        );

    }

    emit(event, payload = {}) {

        if (!this.events.has(event))
            return;

        Logger.debug(`Event: ${event}`);

        for (const listener of this.events.get(event)) {

            try {

                listener(payload);

            }

            catch (error) {

                Logger.error(error);

            }

        }

    }

    clear(event = null) {

        if (event) {

            this.events.delete(event);

            return;

        }

        this.events.clear();

    }

    listenerCount(event) {

        if (!this.events.has(event))
            return 0;

        return this.events.get(event).length;

    }

    has(event) {

        return this.events.has(event);

    }

}