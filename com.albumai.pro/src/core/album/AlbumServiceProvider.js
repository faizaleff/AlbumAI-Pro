import Logger from "../photoshop/Logger";

import AlbumFactory from "./AlbumFactory";

export default class AlbumServiceProvider {

    constructor() {

        this.services = new Map();

    }

    register(name, instance) {

        if (!name) {

            throw new Error(
                "Service name is required."
            );

        }

        this.services.set(

            name,

            instance

        );

        Logger.info(

            `Service registered: ${name}`

        );

        return instance;

    }

    resolve(name) {

        if (

            !this.services.has(name)

        ) {

            throw new Error(

                `Service not found: ${name}`

            );

        }

        return this.services.get(name);

    }

    has(name) {

        return this.services.has(name);

    }

    unregister(name) {

        if (

            this.services.delete(name)

        ) {

            Logger.info(

                `Service removed: ${name}`

            );

        }

    }

    clear() {

        this.services.clear();

        Logger.info(

            "All services cleared."

        );

    }

    registerDefaults() {

        this.register(

            "controller",

            AlbumFactory.createController()

        );

        this.register(

            "engine",

            AlbumFactory.createEngine()

        );

        this.register(

            "kernel",

            AlbumFactory.createKernel()

        );

        this.register(

            "templates",

            AlbumFactory.createTemplateManager()

        );

        this.register(

            "configuration",

            AlbumFactory.createConfiguration()

        );

        this.register(

            "preferences",

            AlbumFactory.createPreferences()

        );

        return this;

    }

    all() {

        return Object.fromEntries(

            this.services.entries()

        );

    }

}