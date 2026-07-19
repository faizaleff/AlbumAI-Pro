// src/core/photo/PhotoCollection.js

import { PhotoStatus } from "./PhotoTypes";

class PhotoCollection {

    constructor() {

        this.photos = new Map();

    }

    /**
     * Add a photo.
     * @param {Object} photo
     */
    add(photo) {

        this.validate(photo);

        if (!photo.status) {
            photo.status = PhotoStatus.NEW;
        }

        this.photos.set(photo.id, photo);

        return photo;

    }

    /**
     * Add multiple photos.
     * @param {Array<Object>} photos
     */
    addMany(photos = []) {

        for (const photo of photos) {
            this.add(photo);
        }

        return this;

    }

    /**
     * Get photo by ID.
     */
    get(id) {

        return this.photos.get(id) ?? null;

    }

    /**
     * Remove photo.
     */
    remove(id) {

        return this.photos.delete(id);

    }

    /**
     * Check existence.
     */
    has(id) {

        return this.photos.has(id);

    }

    /**
     * Update photo.
     */
    update(id, values = {}) {

        const photo = this.get(id);

        if (!photo) {
            throw new Error(`Photo not found: ${id}`);
        }

        Object.assign(photo, values);

        return photo;

    }

    /**
     * Remove everything.
     */
    clear() {

        this.photos.clear();

    }

    /**
     * Number of photos.
     */
    size() {

        return this.photos.size;

    }

    /**
     * Get array of photos.
     */
    all() {

        return [...this.photos.values()];

    }

    /**
     * Find first matching photo.
     */
    find(predicate) {

        return this.all().find(predicate) ?? null;

    }

    /**
     * Filter photos.
     */
    filter(predicate) {

        return this.all().filter(predicate);

    }

    /**
     * Map photos.
     */
    map(callback) {

        return this.all().map(callback);

    }

    /**
     * Iterate photos.
     */
    forEach(callback) {

        this.photos.forEach(callback);

    }

    /**
     * Group by property.
     */
    groupBy(property) {

        const groups = {};

        for (const photo of this.photos.values()) {

            const key = photo[property] ?? "undefined";

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(photo);

        }

        return groups;

    }

    /**
     * Statistics.
     */
    stats() {

        const photos = this.all();

        return {

            total: photos.length,

            used: photos.filter(
                p => p.status === PhotoStatus.USED
            ).length,

            matched: photos.filter(
                p => p.status === PhotoStatus.MATCHED
            ).length,

            analyzed: photos.filter(
                p => p.status === PhotoStatus.ANALYZED
            ).length,

            new: photos.filter(
                p => p.status === PhotoStatus.NEW
            ).length

        };

    }

    validate(photo) {

        if (!photo) {
            throw new Error("Photo is required.");
        }

        if (!photo.id) {
            throw new Error("Photo ID is required.");
        }

    }

}

export default PhotoCollection;