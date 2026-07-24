import ImagingService from "./ImagingService";
import ThumbnailCache from "../cache/ThumbnailCache";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const THUMBNAIL_VERSION = "browser-200-v1";

export function getThumbnailCacheKey(photo) {

    if (!photo) return null;

    const identity = photo.id || photo.file?.name || photo.name;
    const modified = photo.modified instanceof Date
        ? photo.modified.getTime()
        : photo.modified || photo.file?.modified || 0;
    const size = photo.fileSize || photo.file?.size || 0;

    return identity
        ? `${identity}|${modified}|${size}|${THUMBNAIL_VERSION}`
        : null;

}

class ThumbnailService {

    constructor() {

        this.pending = new Map();

    }

    async getThumbnail(photo) {

        if (!photo) {
            return null;
        }

        if (!ImagingService.isSupported()) {
            PhotoBrowserPerformance.cacheSkipped();
            ImagingService.warnUnavailable();
            return ImagingService.placeholderThumbnail(photo);
        }

        const keyStarted =
            PhotoBrowserPerformance.timestamp();
        const key = getThumbnailCacheKey(photo);
        PhotoBrowserPerformance.recordCacheKey(
            PhotoBrowserPerformance.timestamp() - keyStarted
        );

        if (!key) {
            return null;
        }

        // Memory cache
        const lookupStarted =
            PhotoBrowserPerformance.timestamp();
        if (ThumbnailCache.has(key)) {
            PhotoBrowserPerformance.recordCacheLookup(
                PhotoBrowserPerformance.timestamp() -
                    lookupStarted
            );
            PhotoBrowserPerformance.cacheHit();
            return ThumbnailCache.get(key);
        }

        // Prevent duplicate thumbnail generation
        if (this.pending.has(key)) {
            PhotoBrowserPerformance.recordCacheLookup(
                PhotoBrowserPerformance.timestamp() -
                    lookupStarted
            );
            PhotoBrowserPerformance.cacheHit();
            return this.pending.get(key);
        }

        PhotoBrowserPerformance.recordCacheLookup(
            PhotoBrowserPerformance.timestamp() -
                lookupStarted
        );
        PhotoBrowserPerformance.cacheMiss();

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

    isPlaceholder(thumbnail) {

        return ImagingService.isPlaceholder(thumbnail);

    }

    removeThumbnail(photo) {

        const key = getThumbnailCacheKey(photo);

        if (key) {
            ThumbnailCache.remove(key);
        }

    }

    clear({ preserveCache = false } = {}) {

        if (!preserveCache) {
            this.pending.clear();
            ThumbnailCache.clear();
        }

    }

}

export default new ThumbnailService();
