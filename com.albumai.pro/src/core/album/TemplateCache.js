import Logger from "../photoshop/Logger";

export default class TemplateCache {

    constructor() {

        this.cache = new Map();

    }

    has(id) {

        return this.cache.has(id);

    }

    get(id) {

        return this.cache.get(id);

    }

    set(id, template) {

        if (!id) {

            throw new Error(
                "Template id is required."
            );

        }

        this.cache.set(

            id,

            template

        );

        Logger.info(

            `Template cached: ${id}`

        );

        return template;

    }

    remove(id) {

        if (!this.cache.has(id)) {

            return false;

        }

        this.cache.delete(id);

        Logger.info(

            `Template removed from cache: ${id}`

        );

        return true;

    }

    clear() {

        this.cache.clear();

        Logger.info(
            "Template cache cleared."
        );

    }

    size() {

        return this.cache.size;

    }

    values() {

        return Array.from(

            this.cache.values()

        );

    }

    keys() {

        return Array.from(

            this.cache.keys()

        );

    }

}