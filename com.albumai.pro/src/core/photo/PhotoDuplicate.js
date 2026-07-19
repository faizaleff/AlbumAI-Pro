// src/core/photo/PhotoDuplicate.js

class PhotoDuplicate {

    constructor(adapter = null) {

        this.adapter = adapter;

    }

    /**
     * Find duplicates in a collection.
     * @param {Array<Object>} photos
     * @returns {Array<Object>}
     */
    async find(photos = []) {

        const duplicates = [];

        const seen = new Map();

        for (const photo of photos) {

            this.validate(photo);

            const key = await this.createKey(photo);

            if (seen.has(key)) {

                photo.duplicate = true;

                duplicates.push({

                    original: seen.get(key),

                    duplicate: photo

                });

            } else {

                photo.duplicate = false;

                seen.set(key, photo);

            }

        }

        return duplicates;

    }

    /**
     * Compare two photos.
     */
    async compare(photoA, photoB) {

        this.validate(photoA);
        this.validate(photoB);

        const keyA = await this.createKey(photoA);
        const keyB = await this.createKey(photoB);

        return keyA === keyB;

    }

    /**
     * Create comparison key.
     */
    async createKey(photo) {

        if (this.adapter) {

            return await this.adapter.createKey(photo);

        }

        return this.defaultKey(photo);

    }

    /**
     * Default comparison.
     */
    defaultKey(photo) {

        const metadata = photo.metadata ?? {};

        return [

            photo.name,

            metadata.captureDate,

            metadata.width,

            metadata.height,

            metadata.camera

        ].join("|");

    }

    /**
     * Remove duplicate flag.
     */
    clear(photos = []) {

        for (const photo of photos) {

            photo.duplicate = false;

        }

    }

    /**
     * Get duplicate photos.
     */
    getDuplicates(photos = []) {

        return photos.filter(

            photo => photo.duplicate

        );

    }

    /**
     * Get unique photos.
     */
    getUnique(photos = []) {

        return photos.filter(

            photo => !photo.duplicate

        );

    }

    validate(photo) {

        if (!photo) {

            throw new Error("Photo is required.");

        }

    }

}

export default PhotoDuplicate;