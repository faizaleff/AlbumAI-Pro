class AlbumEventBus {

    constructor() {

        this.events = new Map();

    }

    on(event, listener) {

        if (!this.events.has(event))
            this.events.set(event, new Set());

        this.events.get(event).add(listener);

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

        const listeners = this.events.get(event);

        if (!listeners)
            return;

        listeners.delete(listener);

        if (listeners.size === 0)
            this.events.delete(event);

    }

    emit(event, ...args) {

        const listeners = this.events.get(event);

        if (!listeners)
            return;

        [...listeners].forEach(listener => {

            try {

                listener(...args);

            } catch (error) {

                console.error(
                    `[AlbumEventBus] ${event}`,
                    error
                );

            }

        });

    }

    clear(event) {

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

        return this.events.get(event)?.size || 0;

    }

    eventNames() {

        return [...this.events.keys()];

    }

}

export default new AlbumEventBus();