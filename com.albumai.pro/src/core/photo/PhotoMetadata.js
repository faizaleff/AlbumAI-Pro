// src/core/photo/PhotoMetadata.js

import {
    PhotoOrientation,
    PhotoRating
} from "./PhotoTypes";

class PhotoMetadata {

    constructor(adapter) {

        if (!adapter) {
            throw new Error("Metadata adapter is required.");
        }

        this.adapter = adapter;

    }

    /**
     * Read metadata for a photo.
     * @param {Object} photo
     * @returns {Promise<Object>}
     */
    async read(photo) {

        this.validate(photo);

        const raw = await this.adapter.read(photo.file);

        const metadata = this.normalize(raw);

        photo.metadata = metadata;

        return metadata;

    }

    /**
     * Read metadata for multiple photos.
     * @param {Array<Object>} photos
     */
    async readMany(photos = []) {

        for (const photo of photos) {

            await this.read(photo);

        }

        return photos;

    }

    /**
     * Normalize metadata.
     */
    normalize(raw = {}) {

        return {

            captureDate:
                raw.captureDate ??
                raw.dateTimeOriginal ??
                null,

            camera:
                raw.camera ??
                raw.cameraModel ??
                null,

            lens:
                raw.lens ??
                raw.lensModel ??
                null,

            make:
                raw.make ?? null,

            iso:
                raw.iso ?? null,

            aperture:
                raw.aperture ?? null,

            shutterSpeed:
                raw.shutterSpeed ?? null,

            focalLength:
                raw.focalLength ?? null,

            width:
                raw.width ?? null,

            height:
                raw.height ?? null,

            orientation:
                raw.orientation ??
                PhotoOrientation.UNKNOWN,

            rating:
                raw.rating ??
                PhotoRating.REJECTED,

            keywords:
                raw.keywords ?? [],

            gps:
                raw.gps ?? null,

            colorSpace:
                raw.colorSpace ?? null

        };

    }

    /**
     * Clear cached metadata.
     */
    clear(photo) {

        this.validate(photo);

        photo.metadata = null;

    }

    /**
     * Metadata exists?
     */
    has(photo) {

        return !!photo.metadata;

    }

    validate(photo) {

        if (!photo)
            throw new Error("Photo is required.");

        if (!photo.file)
            throw new Error("Photo file is required.");

    }

}

export default PhotoMetadata;