import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

class ThumbnailCache {

    constructor(maxItems = 250) {

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

        const entry = this.cache.get(key);

        entry.lastAccess = Date.now();

        // LRU
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;

    }

    set(key, value) {

        if (!key || value == null) {
            return;
        }

        if (this.cache.has(key)) {
            const previous = this.cache.get(key);
            if (
                previous?.value !== value &&
                typeof previous?.value === "string" &&
                previous.value.startsWith("blob:")
            ) {
                PhotoBrowserPerformance.releaseObjectUrl(
                    previous.value
                );
            }
            this.cache.delete(key);
        }

        this.cache.set(key, {
            value,
            lastAccess: Date.now()
        });

        this.evict();
        PhotoBrowserPerformance.trace("THUMB_CACHE_SIZE", {
            size: this.cache.size
        });

    }

    evict() {

        while (this.cache.size > this.maxItems) {

            const oldestKey =
                this.cache.keys().next().value;

            const oldest =
                this.cache.get(oldestKey);

            try {

                if (
                    typeof oldest?.value === "string" &&
                    oldest.value.startsWith("blob:")
                ) {

                    PhotoBrowserPerformance.releaseObjectUrl(
                        oldest.value
                    );

                }

            } catch (_) {}

            this.cache.delete(oldestKey);
            PhotoBrowserPerformance.trace("THUMB_CACHE_EVICT", {
                key: oldestKey,
                size: this.cache.size
            });

        }

    }

    remove(key) {

        if (!this.cache.has(key)) {
            return;
        }

        const entry = this.cache.get(key);
        PhotoBrowserPerformance.trace(
            "THUMBNAIL_CACHE_REMOVE",
            {
                hasBlobUrl:
                    typeof entry?.value === "string" &&
                    entry.value.startsWith("blob:")
            }
        );

        try {

            if (
                typeof entry?.value === "string" &&
                entry.value.startsWith("blob:")
            ) {

                PhotoBrowserPerformance.releaseObjectUrl(entry.value);

            }

        } catch (_) {}

        this.cache.delete(key);

    }

    clear() {

        PhotoBrowserPerformance.trace(
            "THUMBNAIL_CACHE_CLEAR_BEGIN",
            { entries: this.cache.size }
        );

        for (const [, entry] of this.cache) {

            try {

                if (
                    typeof entry?.value === "string" &&
                    entry.value.startsWith("blob:")
                ) {

                    PhotoBrowserPerformance.releaseObjectUrl(
                        entry.value
                    );

                }

            } catch (_) {}

        }

        this.cache.clear();
        PhotoBrowserPerformance.trace(
            "THUMBNAIL_CACHE_CLEAR_END",
            { entries: this.cache.size }
        );

    }

    size() {

        return this.cache.size;

    }

    keys() {

        return [...this.cache.keys()];

    }

    values() {

        return [...this.cache.values()].map(v => v.value);

    }

    entries() {

        return [...this.cache.entries()].map(
            ([key, value]) => [key, value.value]
        );

    }

}

export default new ThumbnailCache(250);
