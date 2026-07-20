import Logger from "./photoshop/Logger";

export default class ApplicationContext {

    constructor() {

        this.store = new Map();

    }

    set(key, value) {

        this.store.set(key, value);

        Logger.debug(
            `Context Set : ${key}`
        );

        return value;

    }

    get(key) {

        return this.store.get(key);

    }

    has(key) {

        return this.store.has(key);

    }

    remove(key) {

        this.store.delete(key);

    }

    clear() {

        this.store.clear();

        Logger.debug(
            "Application Context Cleared."
        );

    }

    merge(values = {}) {

        Object.entries(values).forEach(

            ([key, value]) => {

                this.store.set(key, value);

            }

        );

    }

    keys() {

        return [

            ...this.store.keys()

        ];

    }

    values() {

        return [

            ...this.store.values()

        ];

    }

    entries() {

        return [

            ...this.store.entries()

        ];

    }

    size() {

        return this.store.size;

    }

    export() {

        return Object.fromEntries(

            this.store.entries()

        );

    }

    import(values = {}) {

        this.clear();

        this.merge(values);

    }

}