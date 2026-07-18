import AlbumAIPro from "../index";

class TemplateController {

    constructor() {

        this.current = null;

    }

    async loadDefaults(templates = []) {

        const loaded = await AlbumAIPro.templates.loader.loadDefaults(
            templates
        );

        AlbumAIPro.core.events.emit(
            "templates:loaded",
            loaded
        );

        return loaded;

    }

    async loadFromJSON(json) {

        const loaded = await AlbumAIPro.templates.loader.loadFromJSON(
            json
        );

        AlbumAIPro.core.events.emit(
            "templates:loaded",
            loaded
        );

        return loaded;

    }

    async loadFromFile(file) {

        const loaded = await AlbumAIPro.templates.loader.loadFromFile(
            file
        );

        AlbumAIPro.core.events.emit(
            "templates:loaded",
            loaded
        );

        return loaded;

    }

    getAll() {

        return AlbumAIPro.templates.library.getAll();

    }

    get(id) {

        return AlbumAIPro.templates.library.getById(id);

    }

    categories() {

        return AlbumAIPro.templates.library.getCategories();

    }

    search(keyword) {

        return AlbumAIPro.templates.library.search(
            keyword
        );

    }

    select(id) {

        const template = this.get(id);

        if (!template)
            throw new Error("Template not found.");

        this.current = template;

        AlbumAIPro.core.state.set(
            "template",
            template
        );

        AlbumAIPro.core.events.emit(
            "template:selected",
            template
        );

        return template;

    }

    currentTemplate() {

        return this.current;

    }

    register(template) {

        return AlbumAIPro.templates.manager.register(
            template
        );

    }

    unregister(id) {

        AlbumAIPro.templates.manager.unregister(id);

        if (this.current?.id === id)
            this.current = null;
    }

    count() {

        return AlbumAIPro.templates.manager.count();

    }

    clear() {

        AlbumAIPro.templates.manager.clear();

        this.current = null;

        AlbumAIPro.core.state.set(
            "template",
            null
        );

        AlbumAIPro.core.events.emit(
            "templates:cleared"
        );

    }

}

export default new TemplateController();