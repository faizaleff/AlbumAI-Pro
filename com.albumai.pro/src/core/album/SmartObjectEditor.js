import Logger from "../photoshop/Logger";
import SmartObjectNavigator from "./SmartObjectNavigator";
import LayerTransformService from "./LayerTransformService";

export default class SmartObjectEditor {

    constructor({

        smartObjectService,

        smartObjectNavigator,

        layerTransformService

    } = {}) {

        this.smartObjectService =
            smartObjectService;

        this.smartObjectNavigator =
            smartObjectNavigator ||
            new SmartObjectNavigator({});

        this.layerTransformService =
            layerTransformService ||
            new LayerTransformService({});

    }

    async replace({

        layer,

        image,

        transform = null

    }) {

        if (!layer) {

            throw new Error(
                "Layer is required."
            );

        }

        if (!image) {

            throw new Error(
                "Image is required."
            );

        }

        Logger.info(

            `Editing Smart Object: ${layer.name}`

        );

        await this.smartObjectService.replace({

            layer,

            image

        });

        if (transform) {

            await this.layerTransformService.transform({

                layer,

                ...transform

            });

        }

        return true;

    }

    async edit({

        layer,

        callback

    }) {

        const document =
            await this.smartObjectNavigator.open(
                layer
            );

        try {

            if (callback) {

                await callback(document);

            }

            await this.smartObjectNavigator.commit(
                document
            );

        }

        catch (error) {

            await this.smartObjectNavigator.close(

                document,

                false

            );

            throw error;

        }

    }

}