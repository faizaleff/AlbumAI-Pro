class AlbumCacheManager {

    constructor(maxItems = 500) {

        this.maxItems = maxItems;

        this.cache = new Map();

    }

    has(key) {

        return this.cache.has(key);

    }

    get(key) {

        if (!this.cache.has(key))
            return null;

        const value = this.cache.get(key);

        this.cache.delete(key);

        this.cache.set(key, value);

        return value;

    }

    set(key, value) {

        if (this.cache.has(key))
            this.cache.delete(key);

        this.cache.set(key, value);

        if (this.cache.size > this.maxItems) {

            const oldest = this.cache.keys().next().value;

            this.cache.delete(oldest);

        }

        return value;

    }

    remove(key) {

        return this.cache.delete(key);

    }

    clear() {

        this.cache.clear();

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

    size() {

        return this.cache.size;

    }

    isEmpty() {

        return this.cache.size === 0;

    }

    statistics() {

        return {

            items: this.cache.size,

            maxItems: this.maxItems,

            usage: Number(

                (
                    this.cache.size /
                    this.maxItems *
                    100
                ).toFixed(2)

            )

        };

    }

}

export default new AlbumCacheManager();