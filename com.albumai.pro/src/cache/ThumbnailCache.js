class ThumbnailCache {

    constructor(maxItems = 2000) {

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
            this.cache.delete(key);
        }

        this.cache.set(key, {
            value,
            lastAccess: Date.now()
        });

        this.evict();

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

                    URL.revokeObjectURL(oldest.value);

                }

            } catch (_) {}

            this.cache.delete(oldestKey);

        }

    }

    remove(key) {

        if (!this.cache.has(key)) {
            return;
        }

        const entry = this.cache.get(key);

        try {

            if (
                typeof entry?.value === "string" &&
                entry.value.startsWith("blob:")
            ) {

                URL.revokeObjectURL(entry.value);

            }

        } catch (_) {}

        this.cache.delete(key);

    }

    clear() {

        for (const [, entry] of this.cache) {

            try {

                if (
                    typeof entry?.value === "string" &&
                    entry.value.startsWith("blob:")
                ) {

                    URL.revokeObjectURL(entry.value);

                }

            } catch (_) {}

        }

        this.cache.clear();

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

export default new ThumbnailCache(2000);