import Logger from "../photoshop/Logger";
import LayerMapper from "./LayerMapper";

export default class FrameDetector {

    constructor({

        layerMapper = new LayerMapper()

    } = {}) {

        this.layerMapper = layerMapper;

    }

    async detect(document) {

        if (!document) {

            throw new Error(

                "Document is required."

            );

        }

        if (typeof this.layerMapper?.scan !== "function") {

            throw new Error(

                "Frame detector requires a layer mapper."

            );

        }

        const frames =

            await this.layerMapper.scan(

                document

            );

        Logger.info(

            `Detected ${frames.length} photo frames.`

        );

        return frames;

    }

    detectByPrefix(

        document,

        prefix = "PHOTO_"

    ) {

        if (!document?.layers) {

            throw new Error(

                "Document layers are required."

            );

        }

        const frames = [];

        const scan = layers => {

            for (const layer of layers) {

                if (

                    layer.name?.startsWith(

                        prefix

                    )

                ) {

                    frames.push(layer);

                }

                if (

                    layer.layers?.length

                ) {

                    scan(

                        layer.layers

                    );

                }

            }

        };

        scan(

            document.layers

        );

        return frames.sort(

            (a, b) =>

                a.name.localeCompare(

                    b.name,

                    undefined,

                    {

                        numeric: true,

                        sensitivity: "base"

                    }

                )

        );

    }

    detectAllSmartObjects(

        document

    ) {

        if (!document?.layers) {

            throw new Error(

                "Document layers are required."

            );

        }

        const smartObjects = [];

        const scan = layers => {

            for (const layer of layers) {

                if (

                    layer.kind ===

                    "smartObject"

                ) {

                    smartObjects.push(

                        layer

                    );

                }

                if (

                    layer.layers?.length

                ) {

                    scan(

                        layer.layers

                    );

                }

            }

        };

        scan(

            document.layers

        );

        return smartObjects;

    }

}
