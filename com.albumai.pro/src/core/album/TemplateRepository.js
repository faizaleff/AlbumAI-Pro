import Logger from "../photoshop/Logger";
import TemplateRegistry from "./TemplateRegistry";
import TemplateCache from "./TemplateCache";

export default class TemplateRepository {

    constructor({

        registry,

        cache

    } = {}) {

        this.registry =
            registry ||
            new TemplateRegistry();

        this.cache =
            cache ||
            new TemplateCache();

    }

    save(template) {

        if (!template) {

            throw new Error(
                "Template is required."
            );

        }

        const id =
            template.id ??
            template.name;

        this.registry.register(template);

        this.cache.set(

            id,

            template

        );

        Logger.info(

            `Template saved: ${id}`

        );

        return template;

    }

    find(id) {

        if (

            this.cache.has(id)

        ) {

            return this.cache.get(id);

        }

        return this.registry.get(id);

    }

    exists(id) {

        return this.registry.has(id);

    }

    remove(id) {

        this.cache.remove(id);

        return this.registry.unregister(id);

    }

    all() {

        return this.registry.getAll();

    }

    count() {

        return this.registry.count();

    }

    clear() {

        this.cache.clear();

        this.registry.clear();

        Logger.info(
            "Template repository cleared."
        );

    }

}