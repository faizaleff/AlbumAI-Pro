export default class CacheEngine {

    constructor() {

        this.cache = new Map();

    }

    set(key, value) {

        this.cache.set(key, value);

    }

    get(key) {

        return this.cache.get(key);

    }

    has(key) {

        return this.cache.has(key);

    }

    clear() {

        this.cache.clear();

    }

}