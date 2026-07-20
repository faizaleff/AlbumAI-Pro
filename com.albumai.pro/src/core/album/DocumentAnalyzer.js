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

        const width = Number(document.width);

        const height = Number(document.height);

        const resolution = Number(

            document.resolution

        );

        if (

            !Number.isFinite(width) ||

            !Number.isFinite(height) ||

            !Number.isFinite(resolution)

        ) {

            throw new Error(

                "Document dimensions and resolution must be numeric."

            );

        }

        const result = {

            name: document.title || document.name || null,

            width,

            height,

            resolution,

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
