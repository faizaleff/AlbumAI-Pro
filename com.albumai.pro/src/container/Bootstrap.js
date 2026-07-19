// src/container/Bootstrap.js

import Container from "./Container";
import registerServices from "./ServiceRegistry";

class Bootstrap {

    constructor() {

        this.container = new Container();
        this.initialized = false;

    }

    /**
     * Initialize the application.
     */
    async initialize() {

        if (this.initialized) {

            return this.container;

        }

        registerServices(this.container);

        await this.initializeInfrastructure();

        this.initialized = true;

        return this.container;

    }

    /**
     * Infrastructure initialization.
     * Keep this lightweight.
     */
    async initializeInfrastructure() {

        // Future examples:
        //
        // await this.container.resolve("settingsService").load();
        // await this.container.resolve("templateRegistry").load();
        // await this.container.resolve("logger").initialize();

    }

    /**
     * Resolve any registered service.
     */
    resolve(name) {

        if (!this.initialized) {

            throw new Error(
                "Application has not been initialized."
            );

        }

        return this.container.resolve(name);

    }

    /**
     * Get the main application service.
     */
    application() {

        return this.resolve(
            "albumGenerationService"
        );

    }

}

export default Bootstrap;