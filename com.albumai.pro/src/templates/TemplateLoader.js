import TemplateManager from "./TemplateManager";
import PSDTemplate from "../album/PSDTemplate";

class TemplateLoader {

    async loadFromJSON(json) {

        const data =
            typeof json === "string"
                ? JSON.parse(json)
                : json;

        const list = Array.isArray(data)
            ? data
            : [data];

        const templates = [];

        for (const item of list) {

            const template = new PSDTemplate(item);

            if (!template.validate())
                continue;

            TemplateManager.register(template);

            templates.push(template);

        }

        return templates;

    }

    async loadFromFile(file) {

        if (!file)
            throw new Error("Template file required.");

        const text = await file.read();

        return this.loadFromJSON(text);

    }

    async reload(file) {

        TemplateManager.clear();

        return this.loadFromFile(file);

    }

    async loadDefaults(defaultTemplates = []) {

        TemplateManager.clear();

        return this.loadFromJSON(defaultTemplates);

    }

}

export default new TemplateLoader();