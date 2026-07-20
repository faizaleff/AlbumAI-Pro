import Logger from "../photoshop/Logger";
import LayerBoundsService from "./LayerBoundsService";
import FrameDetector from "./FrameDetector";

export default class DocumentAnalyzer {

    constructor({

        frameDetector,

        layerBoundsService

    } = {}) {

        this.frameDetector =
            frameDetector ||
            new FrameDetector({});

        this.layerBoundsService =
            layerBoundsService ||
            new LayerBoundsService();

    }

    async analyze(document) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

        const frames =
            await this.frameDetector.detect(
                document
            );

        const result = {

            name: document.title,

            width: document.width,

            height: document.height,

            resolution:
                document.resolution,

            frameCount:
                frames.length,

            frames: frames.map(

                frame => ({

                    id: frame.id,

                    name: frame.name,

                    bounds:

                        this.layerBoundsService.get(
                            frame
                        )

                })

            )

        };

        Logger.info(

            `Document analyzed (${result.frameCount} frames).`

        );

        return result;

    }

}