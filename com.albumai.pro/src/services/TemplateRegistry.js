import Logger from "../core/photoshop/Logger";

export default class TemplateRegistry {

    constructor() {

        this.templates = new Map();
        this.currentTemplateId = null;

    }

    register(template) {

        if (!template)
            throw new Error(
                "Template is required."
            );

        const id =
            template.id ??
            template.name;

        this.templates.set(id, template);
        this.currentTemplateId = id;

        Logger.info(
            `Template Registered: ${id}`
        );

        return template;

    }

    unregister(id) {

        return this.templates.delete(id);

    }

    get(id) {

        return this.templates.get(id) ?? null;

    }

    current() {

        return this.currentTemplateId == null
            ? null
            : this.get(this.currentTemplateId);

    }

    has(id) {

        return this.templates.has(id);

    }

    getAll() {

        return [

            ...this.templates.values()

        ];

    }

    ids() {

        return [

            ...this.templates.keys()

        ];

    }

    count() {

        return this.templates.size;

    }

    clear() {

        this.templates.clear();
        this.currentTemplateId = null;

        Logger.info(
            "Template Registry Cleared."
        );

    }

}
