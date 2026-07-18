import ImagingService from "./ImagingService";
import ThumbnailCache from "../cache/ThumbnailCache";

class ThumbnailService {

    constructor() {

        this.pending = new Map();

    }

    async getThumbnail(photo) {

        if (!photo) {
            return null;
        }

        const key = photo.file?.nativePath || photo.name;

        if (!key) {
            return null;
        }

        // Memory cache
        if (ThumbnailCache.has(key)) {
            return ThumbnailCache.get(key);
        }

        // Prevent duplicate thumbnail generation
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }

        const promise = (async () => {

            try {

                const thumbnail =
                    await ImagingService.createThumbnail(photo);

                if (thumbnail) {

                    ThumbnailCache.set(key, thumbnail);

                }

                return thumbnail || null;

            } catch (error) {

                console.error(
                    `ThumbnailService (${key})`,
                    error
                );

                return null;

            } finally {

                this.pending.delete(key);

            }

        })();

        this.pending.set(key, promise);

        return promise;

    }

    preload(photos = [], limit = 20) {

        const total = Math.min(limit, photos.length);

        for (let i = 0; i < total; i++) {

            this.getThumbnail(photos[i]);

        }

    }

    setThumbnail(key, thumbnail) {

        if (!key || !thumbnail) {
            return;
        }

        ThumbnailCache.set(key, thumbnail);

    }

    hasThumbnail(key) {

        return ThumbnailCache.has(key);

    }

    clear() {

        this.pending.clear();
        ThumbnailCache.clear();

    }

}

export default new ThumbnailService();