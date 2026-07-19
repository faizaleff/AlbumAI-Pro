// src/core/photo/PhotoCache.js

class PhotoCache {

    constructor() {

        this.cache = new Map();

    }

    /**
     * Store a value.
     * @param {string} photoId
     * @param {string} key
     * @param {*} value
     */
    set(photoId, key, value) {

        if (!this.cache.has(photoId)) {
            this.cache.set(photoId, new Map());
        }

        this.cache
            .get(photoId)
            .set(key, value);

        return value;

    }

    /**
     * Retrieve cached value.
     */
    get(photoId, key) {

        return this.cache
            .get(photoId)
            ?.get(key) ?? null;

    }

    /**
     * Check if cached.
     */
    has(photoId, key) {

        return this.cache
            .get(photoId)
            ?.has(key) ?? false;

    }

    /**
     * Remove one cached value.
     */
    remove(photoId, key) {

        const photo = this.cache.get(photoId);

        if (!photo)
            return false;

        return photo.delete(key);

    }

    /**
     * Remove all cache for one photo.
     */
    clearPhoto(photoId) {

        return this.cache.delete(photoId);

    }

    /**
     * Remove everything.
     */
    clear() {

        this.cache.clear();

    }

    /**
     * Get cached value or compute it.
     */
    async remember(photoId, key, callback) {

        if (this.has(photoId, key)) {

            return this.get(photoId, key);

        }

        const value = await callback();

        this.set(photoId, key, value);

        return value;

    }

    /**
     * Cache statistics.
     */
    stats() {

        let entries = 0;

        for (const values of this.cache.values()) {

            entries += values.size;

        }

        return {

            photos: this.cache.size,

            entries

        };

    }

}

export default PhotoCache;