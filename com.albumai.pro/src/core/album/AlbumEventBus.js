import Logger from "../photoshop/Logger";
import AlbumEvents from "./AlbumEvents";

export default class AlbumEventBus {

    constructor() {

        this.events = new AlbumEvents();

    }

    on(event, listener) {

        return this.events.on(

            event,

            listener

        );

    }

    once(event, listener) {

        return this.events.once(

            event,

            listener

        );

    }

    off(event, listener) {

        this.events.off(

            event,

            listener

        );

    }

    emit(event, payload = {}) {

        Logger.info(

            `Album Event: ${event}`

        );

        this.events.emit(

            event,

            payload

        );

    }

    broadcast(event, payload = {}) {

        this.emit(

            event,

            payload

        );

    }

    clear(event = null) {

        this.events.clear(event);

    }

    listeners(event) {

        return this.events.listenerCount(

            event

        );

    }

    registeredEvents() {

        return this.events.events();

    }

    hasListeners(event) {

        return (

            this.listeners(event) > 0

        );

    }

}