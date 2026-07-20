import Logger from "../photoshop/Logger";

export default class PhotoFitEngine {

    fit({

        photoWidth,

        photoHeight,

        frameWidth,

        frameHeight,

        mode = "cover"

    }) {

        if (

            !photoWidth ||
            !photoHeight ||
            !frameWidth ||
            !frameHeight

        ) {

            throw new Error(
                "Invalid dimensions."
            );

        }

        const photoRatio =
            photoWidth / photoHeight;

        const frameRatio =
            frameWidth / frameHeight;

        let scale;

        if (mode === "contain") {

            scale =

                photoRatio > frameRatio

                    ? frameWidth / photoWidth

                    : frameHeight / photoHeight;

        }

        else {

            scale =

                photoRatio > frameRatio

                    ? frameHeight / photoHeight

                    : frameWidth / photoWidth;

        }

        const width =
            photoWidth * scale;

        const height =
            photoHeight * scale;

        const offsetX =
            (frameWidth - width) / 2;

        const offsetY =
            (frameHeight - height) / 2;

        Logger.info(

            `Photo fitted (${mode}).`

        );

        return {

            scale,

            width,

            height,

            offsetX,

            offsetY

        };

    }

}