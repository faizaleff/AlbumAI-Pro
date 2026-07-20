import Logger from "../photoshop/Logger";
import PhotoFitEngine from "./PhotoFitEngine";
import PhotoCropEngine from "./PhotoCropEngine";

export default class PhotoTransformEngine {

    constructor() {

        this.fitEngine =
            new PhotoFitEngine();

        this.cropEngine =
            new PhotoCropEngine();

    }

    calculate({

        imageWidth,

        imageHeight,

        frameWidth,

        frameHeight,

        fit = "cover",

        gravity = "center"

    }) {

        const fitResult =
            this.fitEngine.fit({

                photoWidth: imageWidth,

                photoHeight: imageHeight,

                frameWidth,

                frameHeight,

                mode: fit

            });

        const cropResult =
            this.cropEngine.crop({

                imageWidth,

                imageHeight,

                frameWidth,

                frameHeight,

                gravity

            });

        Logger.info(
            "Photo transform calculated."
        );

        return {

            fit: fitResult,

            crop: cropResult

        };

    }

    apply({

        layer,

        transform

    }) {

        if (!layer) {

            throw new Error(
                "Layer is required."
            );

        }

        layer.transform = {

            ...transform

        };

        Logger.info(

            `Transform applied to ${layer.name}`

        );

        return layer;

    }

}