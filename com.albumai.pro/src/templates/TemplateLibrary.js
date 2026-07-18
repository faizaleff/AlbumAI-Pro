import TemplateManager from "./TemplateManager";

class TemplateLibrary {

    getAll() {

        return TemplateManager.getAll();

    }

    getById(id) {

        return TemplateManager.get(id);

    }

    getByCategory(category) {

        return TemplateManager
            .getAll()
            .filter(template => template.category === category);

    }

    search(keyword = "") {

        const query = keyword.trim().toLowerCase();

        if (!query)
            return this.getAll();

        return TemplateManager
            .getAll()
            .filter(template => {

                return (

                    template.name.toLowerCase().includes(query) ||

                    template.category.toLowerCase().includes(query)

                );

            });

    }

    getCategories() {

        return [

            ...new Set(

                TemplateManager
                    .getAll()
                    .map(template => template.category)

            )

        ].sort();

    }

    getNames() {

        return TemplateManager
            .getAll()
            .map(template => template.name)
            .sort();

    }

    getDefault() {

        const templates = this.getAll();

        return templates.length
            ? templates[0]
            : null;

    }

    random() {

        const templates = this.getAll();

        if (!templates.length)
            return null;

        return templates[
            Math.floor(Math.random() * templates.length)
        ];

    }

    count() {

        return TemplateManager.count();

    }

}

export default new TemplateLibrary();