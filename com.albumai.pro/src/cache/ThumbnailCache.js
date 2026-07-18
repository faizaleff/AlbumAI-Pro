class ThumbnailCache {

    constructor(maxItems = 1000) {

        this.maxItems = maxItems;
        this.cache = new Map();

    }

    has(key) {

        return this.cache.has(key);

    }

    get(key) {

        if (!this.cache.has(key)) {

            return null;

        }

        const value = this.cache.get(key);

        this.cache.delete(key);
        this.cache.set(key, value);

        return value;

    }

    set(key, value) {

        if (!key || !value) {

            return;

        }

        if (this.cache.has(key)) {

            this.cache.delete(key);

        }

        this.cache.set(key, value);

        if (this.cache.size > this.maxItems) {

            const oldestKey = this.cache.keys().next().value;

            this.cache.delete(oldestKey);

        }

    }

    remove(key) {

        this.cache.delete(key);

    }

    clear() {

        this.cache.clear();

    }

    size() {

        return this.cache.size;

    }

    keys() {

        return [...this.cache.keys()];

    }

}

export default new ThumbnailCache(1500);