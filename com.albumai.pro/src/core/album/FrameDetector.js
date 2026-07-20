import Logger from "../photoshop/Logger";

export default class FrameDetector {

    constructor({

        layerMapper

    }) {

        this.layerMapper = layerMapper;

    }

    async detect(document) {

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