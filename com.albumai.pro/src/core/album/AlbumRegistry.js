import Logger from "../photoshop/Logger";

export default class AlbumRegistry {

    constructor() {

        this.items = new Map();

    }

    register(name, value) {

        if (!name) {

            throw new Error(
                "Registry key is required."
            );

        }

        this.items.set(name, value);

        Logger.info(
            `Registry entry added: ${name}`
        );

        return value;

    }

    get(name) {

        return this.items.get(name);

    }

    has(name) {

        return this.items.has(name);

    }

    remove(name) {

        const removed =

            this.items.delete(name);

        if (removed) {

            Logger.info(
                `Registry entry removed: ${name}`
            );

        }

        return removed;

    }

    clear() {

        this.items.clear();

        Logger.info(
            "Registry cleared."
        );

    }

    keys() {

        return [

            ...this.items.keys()

        ];

    }

    values() {

        return [

            ...this.items.values()

        ];

    }

    entries() {

        return [

            ...this.items.entries()

        ];

    }

    count() {

        return this.items.size;

    }

    isEmpty() {

        return this.items.size === 0;

    }

    forEach(callback) {

        this.items.forEach(

            callback

        );

    }

    export() {

        return Object.fromEntries(

            this.items.entries()

        );

    }

}