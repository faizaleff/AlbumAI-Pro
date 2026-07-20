import Logger from "../photoshop/Logger";
import TemplateAnalyzer from "./TemplateAnalyzer";

export default class TemplateScanner {

    constructor({

        templateAnalyzer

    } = {}) {

        this.templateAnalyzer =
            templateAnalyzer ||
            new TemplateAnalyzer();

    }

    async scan(document) {

        if (!document) {

            throw new Error(
                "Template document is required."
            );

        }

        const analysis =
            await this.templateAnalyzer.analyze(
                document
            );

        return {

            document,

            name: analysis.name,

            width: analysis.width,

            height: analysis.height,

            resolution:
                analysis.resolution,

            frames:
                analysis.frames,

            frameCount:
                analysis.photoSlots

        };

    }

    async validate(document) {

        const template =
            await this.scan(document);

        if (template.frameCount === 0) {

            throw new Error(
                "No photo frames found in template."
            );

        }

        Logger.info(

            `Template validated (${template.frameCount} frames).`

        );

        return true;

    }

    async getFrames(document) {

        const template =
            await this.scan(document);

        return template.frames;

    }

}