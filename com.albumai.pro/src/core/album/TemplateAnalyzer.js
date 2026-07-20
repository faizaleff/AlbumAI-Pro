import Logger from "../photoshop/Logger";
import DocumentAnalyzer from "./DocumentAnalyzer";

export default class TemplateAnalyzer {

    constructor({

        documentAnalyzer

    } = {}) {

        this.documentAnalyzer =
            documentAnalyzer ||
            new DocumentAnalyzer();

    }

    async analyze(templateDocument) {

        if (!templateDocument) {

            throw new Error(
                "Template document is required."
            );

        }

        const analysis =
            await this.documentAnalyzer.analyze(
                templateDocument
            );

        const template = {

            name: analysis.name,

            width: analysis.width,

            height: analysis.height,

            resolution:
                analysis.resolution,

            photoSlots:
                analysis.frameCount,

            frames:
                analysis.frames

        };

        Logger.info(

            `Template analyzed (${template.photoSlots} photo slots).`

        );

        return template;

    }

    getFrames(template) {

        return template.frames || [];

    }

    getPhotoSlotCount(template) {

        return template.photoSlots || 0;

    }

}