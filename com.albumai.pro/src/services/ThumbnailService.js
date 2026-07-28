import ThumbnailCache from "../cache/ThumbnailCache";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const THUMBNAIL_VERSION = "browser-200-imaging-v2";

export function getThumbnailCacheKey(photo) {

    if (!photo) return null;

    const identity = photo.id || photo.file?.name || photo.name;
    const modifiedValue = photo.modified || photo.file?.modified ||
        photo.file?.lastModified || 0;
    const modified = modifiedValue instanceof Date
        ? modifiedValue.getTime()
        : typeof modifiedValue === "number"
            ? modifiedValue
            : new Date(modifiedValue).getTime() || 0;
    const size = photo.fileSize || photo.file?.size || 0;

    return identity
        ? `${identity}|${modified}|${size}|${THUMBNAIL_VERSION}`
        : null;

}

class ThumbnailService {

    constructor() {

        this.pending = new Map();

    }

    getCachedThumbnail(photo, context = {}) {

        const key = getThumbnailCacheKey(photo);
        const thumbnail = key ? ThumbnailCache.get(key) : null;
        const details = {
            photoId: photo?.id || null,
            cacheKey: key,
            generation: context.generation ?? null,
            viewMode: context.viewMode || null,
            visible: context.visible === true
        };

        if (context.diagnostic !== false) {
            PhotoBrowserPerformance.trace(
                thumbnail
                    ? "THUMB_CACHE_RESTORE_HIT"
                    : "THUMB_CACHE_RESTORE_MISS",
                details
            );
        }

        return thumbnail;

    }

    getThumbnailResult(photo) {

        if (!photo) {
            return {
                status: "FAILED",
                cacheKey: null,
                source: null
            };
        }

        const keyStarted =
            PhotoBrowserPerformance.timestamp();
        const key = getThumbnailCacheKey(photo);
        PhotoBrowserPerformance.recordCacheKey(
            PhotoBrowserPerformance.timestamp() - keyStarted
        );
        PhotoBrowserPerformance.trace("CACHE_KEY", {
            photoId: photo?.id || null,
            fileId: photo?.file?.nativePath || null,
            key
        });

        if (!key) {
            PhotoBrowserPerformance.trace("CACHE_MISS", {
                photoId: photo?.id || null,
                reason: "missing-cache-key"
            });
            return {
                status: "FAILED",
                cacheKey: null,
                source: null
            };
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
            PhotoBrowserPerformance.trace("CACHE_HIT", {
                photoId: photo?.id || null,
                key,
                source: "memory-cache"
            });
            const source = ThumbnailCache.get(key);
            PhotoBrowserPerformance.trace("THUMB_SERVICE_RESULT", {
                photoId: photo?.id || null,
                cacheKey: key,
                resultStatus: "CACHE_HIT",
                sourceType: typeof source,
                sourcePresent: !!source,
                generation: null,
                cacheSize: ThumbnailCache.size()
            });
            PhotoBrowserPerformance.trace("THUMB_CACHE_ENTRY_TYPE", {
                photoId: photo?.id || null,
                cacheKey: key,
                sourceType: typeof source,
                cacheSize: ThumbnailCache.size()
            });
            return { status: "CACHE_HIT", cacheKey: key, source };
        }

        PhotoBrowserPerformance.recordCacheLookup(
            PhotoBrowserPerformance.timestamp() -
                lookupStarted
        );
        PhotoBrowserPerformance.cacheMiss();
        PhotoBrowserPerformance.trace("CACHE_MISS", {
            photoId: photo?.id || null,
            key,
            reason: "not-present"
        });

        // Browser tiles are cache-only. There is no compliant source creator
        // in this host path, so this is an explicit settled placeholder—not a
        // successful thumbnail job and never a retry candidate.
        PhotoBrowserPerformance.trace("THUMB_SERVICE_RESULT", {
            photoId: photo?.id || null,
            cacheKey: key,
            resultStatus: "UNSUPPORTED",
            sourceType: null,
            sourcePresent: false,
            generation: null,
            cacheSize: ThumbnailCache.size()
        });
        PhotoBrowserPerformance.trace("THUMB_CACHE_WRITE_SKIPPED", {
            photoId: photo?.id || null,
            cacheKey: key,
            resultStatus: "UNSUPPORTED",
            sourceType: null,
            sourcePresent: false,
            generation: null,
            cacheSize: ThumbnailCache.size()
        });
        return { status: "UNSUPPORTED", cacheKey: key, source: null };

    }

    async getThumbnail(photo) {

        return this.getThumbnailResult(photo).source;

    }

    /**
     * Restores an already-generated browser thumbnail without scheduling any
     * decode work. This lets a folder refresh render its LRU-resident tiles
     * immediately while leaving uncached files as placeholders.
     */
    restoreCachedThumbnail(photo) {

        const key = getThumbnailCacheKey(photo);

        PhotoBrowserPerformance.trace("CACHE_KEY", {
            photoId: photo?.id || null,
            fileId: photo?.file?.nativePath || null,
            key
        });

        const thumbnail = this.getCachedThumbnail(photo);

        if (!thumbnail) {
            PhotoBrowserPerformance.trace("CACHE_RESTORE", {
                photoId: photo?.id || null,
                key,
                restored: false
            });
            return null;
        }

        photo.setThumbnail?.(thumbnail);
        photo.thumbnail = thumbnail;
        photo.loaded = true;
        PhotoBrowserPerformance.cacheHit();
        PhotoBrowserPerformance.trace("THUMBNAIL_CACHE_REUSED", {
            name: photo.name || "unnamed"
        });
        PhotoBrowserPerformance.trace("CACHE_RESTORE", {
            photoId: photo?.id || null,
            key,
            restored: true
        });

        return thumbnail;

    }

    hasCachedThumbnails() {

        return ThumbnailCache.size() > 0;

    }

    preload(photos = [], limit = 20) {

        const total = Math.min(limit, photos.length);

        for (let i = 0; i < total; i++) {

            this.getThumbnail(photos[i]);

        }

    }

    setThumbnail(key, thumbnail) {

        PhotoBrowserPerformance.trace("THUMB_CACHE_WRITE_ATTEMPT", {
            photoId: null,
            cacheKey: key || null,
            resultStatus: thumbnail ? "SOURCE_CREATED" : "FAILED",
            sourceType: typeof thumbnail,
            sourcePresent: !!thumbnail,
            generation: null,
            cacheSize: ThumbnailCache.size()
        });

        if (!key || !thumbnail) {
            PhotoBrowserPerformance.trace("THUMB_CACHE_WRITE_SKIPPED", {
                photoId: null,
                cacheKey: key || null,
                resultStatus: "FAILED",
                sourceType: typeof thumbnail,
                sourcePresent: !!thumbnail,
                generation: null,
                cacheSize: ThumbnailCache.size()
            });
            return;
        }

        ThumbnailCache.set(key, thumbnail);
        PhotoBrowserPerformance.trace("THUMB_CACHE_WRITE_SUCCESS", {
            photoId: null,
            cacheKey: key,
            resultStatus: "SOURCE_CREATED",
            sourceType: typeof thumbnail,
            sourcePresent: true,
            generation: null,
            cacheSize: ThumbnailCache.size()
        });

    }

    hasThumbnail(key) {

        return ThumbnailCache.has(key);

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
