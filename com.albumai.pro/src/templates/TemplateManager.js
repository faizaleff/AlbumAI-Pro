import PSDTemplate from "../album/PSDTemplate";

class TemplateManager {

    constructor() {

        this.templates = new Map();

    }

    register(template) {

        const item =
            template instanceof PSDTemplate
                ? template
                : new PSDTemplate(template);

        this.templates.set(item.id, item);

        return item;

    }

    unregister(id) {

        this.templates.delete(id);

    }

    get(id) {

        return this.templates.get(id) || null;

    }

    getAll() {

        return [...this.templates.values()];

    }

    exists(id) {

        return this.templates.has(id);

    }

    clear() {

        this.templates.clear();

    }

    count() {

        return this.templates.size;

    }

    async load(list = []) {

        this.clear();

        for (const item of list)
            this.register(item);

        return this.getAll();

    }

    export() {

        return this.getAll().map(template => template.toJSON());

    }

    import(data = []) {

        this.clear();

        data.forEach(item => this.register(item));

        return this.getAll();

    }

    filter(category) {

        return this.getAll().filter(

            template => template.category === category

        );

    }

}

export default new TemplateManager();