import Logger from "../photoshop/Logger";
import TemplateScanner from "./TemplateScanner";

export default class TemplateValidator {

    constructor({

        templateScanner

    } = {}) {

        this.templateScanner =
            templateScanner ||
            new TemplateScanner();

    }

    async validate(document) {

        const template =
            await this.templateScanner.scan(
                document
            );

        const errors = [];

        if (!template.name) {

            errors.push(
                "Template name is missing."
            );

        }

        if (

            template.width <= 0 ||

            template.height <= 0

        ) {

            errors.push(
                "Invalid document size."
            );

        }

        if (

            template.resolution <= 0

        ) {

            errors.push(
                "Invalid resolution."
            );

        }

        if (

            template.frameCount === 0

        ) {

            errors.push(
                "No photo frames found."
            );

        }

        const valid =
            errors.length === 0;

        if (valid) {

            Logger.info(
                "Template validation passed."
            );

        } else {

            Logger.warn(
                "Template validation failed."
            );

        }

        return {

            valid,

            errors,

            template

        };

    }

}