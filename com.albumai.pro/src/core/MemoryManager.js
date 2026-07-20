import Logger from "./photoshop/Logger";

export default class MemoryManager {

    constructor() {

        this.cache = new Map();

        this.createdAt = Date.now();

    }

    set(key, value) {

        this.cache.set(key, value);

        return value;

    }

    get(key) {

        return this.cache.get(key);

    }

    has(key) {

        return this.cache.has(key);

    }

    remove(key) {

        return this.cache.delete(key);

    }

    clear() {

        this.cache.clear();

        Logger.info(
            "Memory cache cleared."
        );

    }

    size() {

        return this.cache.size;

    }

    keys() {

        return [...this.cache.keys()];

    }

    values() {

        return [...this.cache.values()];

    }

    entries() {

        return [...this.cache.entries()];

    }

    memoryUsage() {

        return {

            items: this.cache.size,

            uptime:

                Date.now() -

                this.createdAt

        };

    }

    dispose() {

        this.clear();

        Logger.info(
            "Memory manager disposed."
        );

    }

}