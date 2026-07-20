import Logger from "../photoshop/Logger";

export default class PhotoCropEngine {

    crop({

        imageWidth,

        imageHeight,

        frameWidth,

        frameHeight,

        gravity = "center"

    }) {

        const dimensions = [

            imageWidth,
            imageHeight,
            frameWidth,
            frameHeight

        ];

        if (dimensions.some(

            value => !Number.isFinite(value) || value <= 0

        )) {

            throw new Error(
                "Invalid crop dimensions."
            );

        }

        if (![

            "center",
            "top",
            "bottom",
            "left",
            "right"

        ].includes(gravity)) {

            throw new Error(

                `Unsupported crop gravity: ${gravity}`

            );

        }

        const imageRatio =
            imageWidth / imageHeight;

        const frameRatio =
            frameWidth / frameHeight;

        let cropWidth = imageWidth;
        let cropHeight = imageHeight;

        if (imageRatio > frameRatio) {

            cropWidth =
                imageHeight * frameRatio;

        } else {

            cropHeight =
                imageWidth / frameRatio;

        }

        let x = 0;
        let y = 0;

        switch (gravity) {

            case "top":

                x = (imageWidth - cropWidth) / 2;
                y = 0;
                break;

            case "bottom":

                x = (imageWidth - cropWidth) / 2;
                y = imageHeight - cropHeight;
                break;

            case "left":

                x = 0;
                y = (imageHeight - cropHeight) / 2;
                break;

            case "right":

                x = imageWidth - cropWidth;
                y = (imageHeight - cropHeight) / 2;
                break;

            default:

                x = (imageWidth - cropWidth) / 2;
                y = (imageHeight - cropHeight) / 2;

        }

        Logger.info(
            "Crop calculated."
        );

        return {

            x,

            y,

            width: cropWidth,

            height: cropHeight

        };

    }

}
