import Logger from "./photoshop/Logger";

export default class Kernel {

    constructor(container) {

        this.container = container;

        this.booted = false;

    }

    register(name, service) {

        this.container.register(
            name,
            service
        );

        return this;

    }

    singleton(name, factory) {

        this.container.singleton(
            name,
            factory
        );

        return this;

    }

    resolve(name) {

        return this.container.resolve(name);

    }

    has(name) {

        return this.container.has(name);

    }

    async boot() {

        if (this.booted)
            return;

        Logger.info(
            "Kernel booting..."
        );

        const bootables = [

            "configurationService",

            "eventBus",

            "sessionService",

            "stateService",

            "statisticsService"

        ];

        for (const serviceName of bootables) {

            if (!this.has(serviceName))
                continue;

            const service =
                this.resolve(serviceName);

            if (
                typeof service.initialize ===
                "function"
            ) {

                await service.initialize();

            }

        }

        this.booted = true;

        Logger.info(
            "Kernel ready."
        );

    }

    async shutdown() {

        if (!this.booted)
            return;

        const services = [

            ...this.container.values()

        ].reverse();

        for (const service of services) {

            if (

                typeof service.shutdown ===
                "function"

            ) {

                await service.shutdown();

            }

        }

        this.booted = false;

        Logger.info(
            "Kernel stopped."

        );

    }

}