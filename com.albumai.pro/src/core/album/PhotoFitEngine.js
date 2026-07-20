import Logger from "../photoshop/Logger";

export default class PhotoFitEngine {

    fit({

        photoWidth,

        photoHeight,

        frameWidth,

        frameHeight,

        mode = "cover"

    }) {

        const dimensions = [

            photoWidth,
            photoHeight,
            frameWidth,
            frameHeight

        ];

        if (dimensions.some(

            value => !Number.isFinite(value) || value <= 0

        )) {

            throw new Error(
                "Invalid dimensions."
            );

        }

        if (mode !== "cover" && mode !== "contain") {

            throw new Error(

                `Unsupported fit mode: ${mode}`

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
