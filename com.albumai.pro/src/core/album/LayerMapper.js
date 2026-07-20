import Logger from "../photoshop/Logger";

export default class LayerMapper {

    constructor({

        framePrefix = "PHOTO_"

    } = {}) {

        this.layers = [];

        this.framePrefix = framePrefix;

    }

    async scan(document) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

        this.layers = [];

        const walk = layer => {

            if (!layer) {

                return;

            }

            if (

                layer.name &&
                layer.name.startsWith(
                    this.framePrefix
                )

            ) {

                this.layers.push(layer);

            }

            if (

                layer.layers &&
                layer.layers.length

            ) {

                layer.layers.forEach(walk);

            }

        };

        if (!document.layers) {

            throw new Error(

                "Document layers are required."

            );

        }

        document.layers.forEach(walk);

        this.layers.sort((a, b) =>

            a.name.localeCompare(

                b.name,

                undefined,

                {

                    numeric: true,

                    sensitivity: "base"

                }

            )

        );

        Logger.info(

            `${this.layers.length} photo frames mapped.`

        );

        return this.layers;

    }

    getFrames() {

        return [...this.layers];

    }

    getFrame(index) {

        return this.layers[index];

    }

    count() {

        return this.layers.length;

    }

    clear() {

        this.layers = [];

    }

}
