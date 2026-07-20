import Logger from "../photoshop/Logger";

export default class TemplateRegistry {

    constructor() {

        this.templates = new Map();

    }

    register(template) {

        if (!template) {

            throw new Error(
                "Template is required."
            );

        }

        const id =

            template.id ??

            template.name;

        if (!id) {

            throw new Error(
                "Template id is required."
            );

        }

        this.templates.set(

            id,

            template

        );

        Logger.info(

            `Template registered: ${id}`

        );

        return template;

    }

    unregister(id) {

        const removed =

            this.templates.delete(id);

        if (removed) {

            Logger.info(

                `Template unregistered: ${id}`

            );

        }

        return removed;

    }

    has(id) {

        return this.templates.has(id);

    }

    get(id) {

        return this.templates.get(id);

    }

    getAll() {

        return Array.from(

            this.templates.values()

        );

    }

    count() {

        return this.templates.size;

    }

    clear() {

        this.templates.clear();

        Logger.info(
            "Template registry cleared."
        );

    }

}