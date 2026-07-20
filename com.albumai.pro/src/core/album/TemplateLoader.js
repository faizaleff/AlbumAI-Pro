import Logger from "../photoshop/Logger";
import TemplateValidator from "./TemplateValidator";
import Photoshop from "../photoshop";

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

        if (typeof this.templateService?.load !== "function") {

            throw new Error(

                "Template loader requires a template service."

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

        await Photoshop.execute(
            () => document.close({ save: false }),
            { commandName: "Close Album Template" }
        );

        Logger.info(

            "Template unloaded."

        );

    }

}
