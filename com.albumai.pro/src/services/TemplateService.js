import Logger from "../core/photoshop/Logger";

export default class TemplateService {

    constructor({
        documentManager,
        validationService
    }) {

        this.documentManager = documentManager;
        this.validationService = validationService;

    }

    async load(templateFile) {

        this.validationService.validateTemplate(
            templateFile
        );

        Logger.info(
            `Loading template: ${templateFile.name}`
        );

        return await this.documentManager.open(
            templateFile
        );

    }

    async activate(document) {

        return await this.documentManager.activate(
            document
        );

    }

    async save(document) {

        return await this.documentManager.save(
            document
        );

    }

    async close(document, save = false) {

        return await this.documentManager.close(
            document,
            save
        );

    }

    async duplicate(document, name) {

        if (!document)
            throw new Error(
                "Document not found."
            );

        Logger.info(
            "Duplicating template."
        );

        return await document.duplicate(name);

    }

}