import Logger from "./photoshop/Logger";

export default class CacheManager {

    constructor() {

        this.cache = new Map();

    }

    set(key, value, ttl = null) {

        this.cache.set(key, {

            value,

            expires:

                ttl

                    ? Date.now() + ttl

                    : null

        });

        return value;

    }

    get(key) {

        const item = this.cache.get(key);

        if (!item)
            return null;

        if (

            item.expires &&

            Date.now() > item.expires

        ) {

            this.cache.delete(key);

            return null;

        }

        return item.value;

    }

    has(key) {

        return this.get(key) !== null;

    }

    remove(key) {

        return this.cache.delete(key);

    }

    clear() {

        this.cache.clear();

        Logger.info(
            "Cache cleared."
        );

    }

    keys() {

        return [...this.cache.keys()];

    }

    values() {

        return [...this.cache.values()]
            .map(x => x.value);

    }

    size() {

        return this.cache.size;

    }

    cleanup() {

        for (const [key, value] of this.cache) {

            if (

                value.expires &&

                Date.now() > value.expires

            ) {

                this.cache.delete(key);

            }

        }

    }

}