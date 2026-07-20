import Logger from "../photoshop/Logger";

export default class AlbumContext {

    constructor(initialData = {}) {

        this.data = new Map();

        this.merge(initialData);

    }

    set(key, value) {

        this.data.set(key, value);

        return value;

    }

    get(key, defaultValue = null) {

        if (!this.data.has(key)) {

            return defaultValue;

        }

        return this.data.get(key);

    }

    has(key) {

        return this.data.has(key);

    }

    remove(key) {

        return this.data.delete(key);

    }

    clear() {

        this.data.clear();

    }

    merge(values = {}) {

        Object.entries(values).forEach(

            ([key, value]) => {

                this.data.set(key, value);

            }

        );

        return this;

    }

    increment(key, amount = 1) {

        const current =

            Number(this.get(key, 0));

        this.set(

            key,

            current + amount

        );

    }

    decrement(key, amount = 1) {

        const current =

            Number(this.get(key, 0));

        this.set(

            key,

            current - amount

        );

    }

    reset() {

        this.clear();

        Logger.info(

            "Album context reset."

        );

    }

    keys() {

        return [

            ...this.data.keys()

        ];

    }

    values() {

        return [

            ...this.data.values()

        ];

    }

    entries() {

        return [

            ...this.data.entries()

        ];

    }

    toObject() {

        return Object.fromEntries(

            this.data.entries()

        );

    }

}