import Logger from "../photoshop/Logger";
import TemplateValidator from "./TemplateValidator";

export default class TemplateLoader {

    constructor({

        templateService,

        templateValidator

    } = {}) {

        this.templateService =
            templateService;

        this.templateValidator =
            templateValidator ||
            new TemplateValidator();

    }

    async load(template) {

        if (!template) {

            throw new Error(
                "Template is required."
            );

        }

        Logger.info(

            `Loading template: ${template.name || template}`

        );

        const document =
            await this.templateService.load(
                template
            );

        const result =
            await this.templateValidator.validate(
                document
            );

        if (!result.valid) {

            throw new Error(

                result.errors.join("\n")

            );

        }

        Logger.info(

            "Template loaded successfully."

        );

        return {

            document,

            template:

                result.template

        };

    }

    async unload(document) {

        if (!document) {

            return;

        }

        await document.close();

        Logger.info(

            "Template unloaded."

        );

    }

}