// src/container/Container.js

class Container {

    constructor() {

        this.services = new Map();
        this.singletons = new Map();

    }

    /**
     * Register a singleton.
     */
    singleton(name, factory) {

        this.services.set(name, {
            type: "singleton",
            factory
        });

    }

    /**
     * Register a transient service.
     */
    transient(name, factory) {

        this.services.set(name, {
            type: "transient",
            factory
        });

    }

    /**
     * Resolve a service.
     */
    resolve(name) {

        if (!this.services.has(name)) {

            throw new Error(
                `Service '${name}' is not registered.`
            );

        }

        const registration =
            this.services.get(name);

        if (registration.type === "singleton") {

            if (!this.singletons.has(name)) {

                const instance =
                    registration.factory(this);

                this.singletons.set(
                    name,
                    instance
                );

            }

            return this.singletons.get(name);

        }

        return registration.factory(this);

    }

    /**
     * Check registration.
     */
    has(name) {

        return this.services.has(name);

    }

    /**
     * Remove singleton cache.
     */
    reset() {

        this.singletons.clear();

    }

}

export default Container;