import Logger from "../core/photoshop/Logger";

export default class NotificationService {

    constructor(eventBus = null) {

        this.eventBus = eventBus;

    }

    info(message) {

        this.notify("info", message);

    }

    success(message) {

        this.notify("success", message);

    }

    warning(message) {

        this.notify("warning", message);

    }

    error(message) {

        this.notify("error", message);

    }

    notify(type, message, data = {}) {

        const payload = {

            type,

            message,

            timestamp: new Date(),

            ...data

        };

        Logger.info(
            `[${type.toUpperCase()}] ${message}`
        );

        if (

            this.eventBus &&

            typeof this.eventBus.emit === "function"

        ) {

            this.eventBus.emit(

                "notification",

                payload

            );

        }

        return payload;

    }

}