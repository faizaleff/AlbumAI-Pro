import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

function isBlobUrl(value) {

    return typeof value === "string" && value.startsWith("blob:");

}

class ThumbnailCache {

    constructor(maxItems = 250) {

        this.maxItems = maxItems;
        this.cache = new Map();
        this.sourceOwners = new Map();

    }

    has(key) {

        return this.cache.has(key);

    }

    get(key) {

        if (!this.cache.has(key)) return null;
        const entry = this.cache.get(key);
        entry.lastAccess = Date.now();
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;

    }

    set(key, value) {

        if (!key || value == null) return;

        const previous = this.cache.get(key);
        if (previous?.value === value) {
            previous.lastAccess = Date.now();
            this.cache.delete(key);
            this.cache.set(key, previous);
            return;
        }

        if (previous) {
            this.cache.delete(key);
            this.releaseCacheOwner(previous.value);
        }

        this.cache.set(key, {
            value,
            lastAccess: Date.now()
        });
        this.retainCacheOwner(value);
        this.evict();
        this.traceSize();

    }

    evict() {

        while (this.cache.size > this.maxItems) {
            const oldestKey = this.cache.keys().next().value;
            const oldest = this.cache.get(oldestKey);
            this.cache.delete(oldestKey);
            this.releaseCacheOwner(oldest?.value);
            PhotoBrowserPerformance.trace("THUMB_CACHE_EVICT", {
                profile:
                    String(oldestKey).endsWith("preview-1000-v5")
                        ? "preview"
                        : "thumbnail",
                size: this.cache.size
            });
        }

    }

    remove(key) {

        const entry = this.cache.get(key);
        if (!entry) return;
        this.cache.delete(key);
        this.releaseCacheOwner(entry.value);
        this.traceSize();

    }

    clear(reason = "cache-clear") {

        const entriesBefore = this.cache.size;
        for (const entry of this.cache.values()) {
            this.releaseCacheOwner(entry.value);
        }
        this.cache.clear();
        PhotoBrowserPerformance.trace(
            "THUMBNAIL_CACHE_CLEAR_SUMMARY",
            {
                reason,
                entriesBefore,
                entriesAfter: this.cache.size
            }
        );

    }

    retainCacheOwner(source) {

        if (!isBlobUrl(source)) return;
        const owners = this.getOrCreateOwners(source);
        owners.cache++;

    }

    releaseCacheOwner(source) {

        if (!isBlobUrl(source)) return;
        const owners = this.sourceOwners.get(source);
        if (!owners) return;
        owners.cache = Math.max(0, owners.cache - 1);
        this.releaseIfUnowned(source, owners);

    }

    retainSource(source) {

        if (!isBlobUrl(source)) return;
        const owners = this.sourceOwners.get(source);
        if (!owners) return;
        owners.consumers++;

    }

    releaseSource(source) {

        if (!isBlobUrl(source)) return;
        const owners = this.sourceOwners.get(source);
        if (!owners) return;
        owners.consumers = Math.max(0, owners.consumers - 1);
        this.releaseIfUnowned(source, owners);

    }

    getOrCreateOwners(source) {

        if (!this.sourceOwners.has(source)) {
            this.sourceOwners.set(source, {
                cache: 0,
                consumers: 0
            });
        }
        return this.sourceOwners.get(source);

    }

    releaseIfUnowned(source, owners) {

        if (owners.cache > 0 || owners.consumers > 0) return;
        this.sourceOwners.delete(source);
        PhotoBrowserPerformance.releaseObjectUrl(source);

    }

    traceSize() {

        PhotoBrowserPerformance.trace("THUMB_CACHE_SIZE", {
            size: this.cache.size
        });

    }

    size() {

        return this.cache.size;

    }

    keys() {

        return [...this.cache.keys()];

    }

    values() {

        return [...this.cache.values()].map(entry => entry.value);

    }

    entries() {

        return [...this.cache.entries()].map(
            ([key, entry]) => [key, entry.value]
        );

    }

}

export default new ThumbnailCache(250);
