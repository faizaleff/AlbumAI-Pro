import Logger from "../core/photoshop/Logger";

export default class TemplateCacheService {

    constructor() {

        this.templates = new Map();

    }

    add(id, document) {

        this.templates.set(id, {

            id,

            document,

            loadedAt: new Date()

        });

        Logger.info(
            `Template Cached: ${id}`
        );

        return document;

    }

    get(id) {

        return this.templates.get(id)?.document ?? null;

    }

    has(id) {

        return this.templates.has(id);

    }

    remove(id) {

        this.templates.delete(id);

    }

    clear() {

        this.templates.clear();

        Logger.info(
            "Template Cache Cleared."
        );

    }

    size() {

        return this.templates.size;

    }

    ids() {

        return [

            ...this.templates.keys()

        ];

    }

    list() {

        return [

            ...this.templates.values()

        ];

    }

}