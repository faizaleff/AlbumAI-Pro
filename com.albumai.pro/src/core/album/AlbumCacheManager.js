import Logger from "../photoshop/Logger";

export default class AlbumCacheManager {

    constructor() {

        this.clear();

    }

    clear() {

        this.cache = {

            documents: new Map(),

            templates: new Map(),

            thumbnails: new Map(),

            smartObjects: new Map(),

            photos: new Map(),

            metadata: new Map(),

            sessions: new Map()

        };

    }

    set(category, key, value) {

        this.getCategory(category).set(

            key,

            {

                value,

                createdAt: Date.now(),

                accessedAt: Date.now()

            }

        );

    }

    get(category, key) {

        const item =

            this.getCategory(category).get(key);

        if (!item) {

            return null;

        }

        item.accessedAt = Date.now();

        return item.value;

    }

    has(category, key) {

        return this.getCategory(category).has(key);

    }

    remove(category, key) {

        this.getCategory(category).delete(key);

    }

    keys(category) {

        return Array.from(

            this.getCategory(category).keys()

        );

    }

    values(category) {

        return Array.from(

            this.getCategory(category).values()

        ).map(item => item.value);

    }

    size(category) {

        return this.getCategory(category).size;

    }

    clearCategory(category) {

        this.getCategory(category).clear();

    }

    getCategory(category) {

        if (!(category in this.cache)) {

            throw new Error(

                `Unknown cache: ${category}`

            );

        }

        return this.cache[category];

    }

    statistics() {

        return {

            documents:

                this.cache.documents.size,

            templates:

                this.cache.templates.size,

            thumbnails:

                this.cache.thumbnails.size,

            smartObjects:

                this.cache.smartObjects.size,

            photos:

                this.cache.photos.size,

            metadata:

                this.cache.metadata.size,

            sessions:

                this.cache.sessions.size

        };

    }

    cleanup(maxAge = 3600000) {

        const now = Date.now();

        Object.values(this.cache).forEach(map => {

            for (const [key, value] of map) {

                if (

                    now - value.accessedAt >

                    maxAge

                ) {

                    map.delete(key);

                }

            }

        });

        Logger.info(

            "Album cache cleaned."

        );

    }

}