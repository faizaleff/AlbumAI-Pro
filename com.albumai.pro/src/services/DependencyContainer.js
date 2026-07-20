import Logger from "../core/photoshop/Logger";

export default class DependencyContainer {

    constructor() {

        this.services = new Map();

    }

    register(name, instance) {

        if (!name)
            throw new Error("Service name required.");

        if (!instance)
            throw new Error("Service instance required.");

        this.services.set(name, instance);

        Logger.debug(
            `Registered: ${name}`
        );

        return instance;

    }

    singleton(name, factory) {

        if (this.services.has(name))
            return this.services.get(name);

        const instance = factory();

        this.register(name, instance);

        return instance;

    }

    resolve(name) {

        if (!this.services.has(name)) {

            throw new Error(
                `Service not registered: ${name}`
            );

        }

        return this.services.get(name);

    }

    has(name) {

        return this.services.has(name);

    }

    remove(name) {

        this.services.delete(name);

    }

    clear() {

        this.services.clear();

    }

    keys() {

        return [...this.services.keys()];

    }

    values() {

        return [...this.services.values()];

    }

    entries() {

        return [...this.services.entries()];

    }

    count() {

        return this.services.size;

    }

}