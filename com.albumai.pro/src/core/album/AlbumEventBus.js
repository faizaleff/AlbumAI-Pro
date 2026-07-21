export default class AlbumEventBus {

    constructor() {

        this.events = new Map();

    }

    on(event, listener) {

        if (!this.events.has(event)) {

            this.events.set(event, []);

        }

        this.events.get(event).push(listener);

        return () => this.off(event, listener);

    }

    once(event, listener) {

        const wrapper = (...args) => {

            this.off(event, wrapper);

            listener(...args);

        };

        return this.on(event, wrapper);

    }

    off(event, listener) {

        if (!this.events.has(event)) {

            return;

        }

        const listeners = this.events.get(event);

        const index = listeners.indexOf(listener);

        if (index >= 0) {

            listeners.splice(index, 1);

        }

        if (listeners.length === 0) {

            this.events.delete(event);

        }

    }

    emit(event, payload = {}) {

        if (!this.events.has(event)) {

            return;

        }

        for (const listener of this.events.get(event)) {

            try {

                listener(payload);

            }

            catch (error) {

                console.error(

                    `[AlbumEventBus] ${event}`,

                    error

                );

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

    has(event) {

        return this.events.has(event);

    }

    listenerCount(event) {

        return this.events.has(event)

            ? this.events.get(event).length

            : 0;

    }

    eventNames() {

        return Array.from(

            this.events.keys()

        );

    }

}