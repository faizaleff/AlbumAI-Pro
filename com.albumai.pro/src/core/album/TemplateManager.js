import Logger from "../photoshop/Logger";
import TemplateLoader from "./TemplateLoader";
import TemplateScanner from "./TemplateScanner";

export default class TemplateManager {

    constructor({

        templateLoader,

        templateScanner

    } = {}) {

        this.templateLoader =
            templateLoader ||
            new TemplateLoader();

        this.templateScanner =
            templateScanner ||
            new TemplateScanner();

        this.document = null;

        this.template = null;

    }

    async open(templateFile) {

        const result =
            await this.templateLoader.load(
                templateFile
            );

        this.document =
            result.document;

        this.template =
            result.template;

        Logger.info(
            "Template opened."
        );

        return result;

    }

    async reload() {

        if (!this.document) {

            throw new Error(
                "No template loaded."
            );

        }

        this.template =
            await this.templateScanner.scan(
                this.document
            );

        Logger.info(
            "Template reloaded."
        );

        return this.template;

    }

    async close() {

        if (!this.document) {

            return;

        }

        await this.templateLoader.unload(
            this.document
        );

        this.document = null;

        this.template = null;

        Logger.info(
            "Template closed."
        );

    }

    getDocument() {

        return this.document;

    }

    getTemplate() {

        return this.template;

    }

    hasTemplate() {

        return this.document !== null;

    }

}