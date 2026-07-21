export default class ImageFitService {

    constructor() {

        this.modes = {

            COVER: "cover",

            CONTAIN: "contain",

            STRETCH: "stretch",

            CENTER: "center"

        };

    }

    calculate({

        imageWidth,

        imageHeight,

        frameWidth,

        frameHeight,

        mode = "cover"

    }) {

        if (
            !imageWidth ||
            !imageHeight ||
            !frameWidth ||
            !frameHeight
        ) {

            throw new Error(
                "Invalid image or frame size."
            );

        }

        switch (mode) {

            case this.modes.CONTAIN:

                return this.contain({

                    imageWidth,

                    imageHeight,

                    frameWidth,

                    frameHeight

                });

            case this.modes.STRETCH:

                return this.stretch({

                    frameWidth,

                    frameHeight

                });

            case this.modes.CENTER:

                return this.center({

                    imageWidth,

                    imageHeight,

                    frameWidth,

                    frameHeight

                });

            case this.modes.COVER:

            default:

                return this.cover({

                    imageWidth,

                    imageHeight,

                    frameWidth,

                    frameHeight

                });

        }

    }

    cover(data) {

        const scale = Math.max(

            data.frameWidth / data.imageWidth,

            data.frameHeight / data.imageHeight

        );

        return this.result(data, scale);

    }

    contain(data) {

        const scale = Math.min(

            data.frameWidth / data.imageWidth,

            data.frameHeight / data.imageHeight

        );

        return this.result(data, scale);

    }

    stretch(data) {

        return {

            width: data.frameWidth,

            height: data.frameHeight,

            scaleX: 1,

            scaleY: 1,

            offsetX: 0,

            offsetY: 0,

            crop: false

        };

    }

    center(data) {

        return this.result(data, 1);

    }

    result(data, scale) {

        const width =
            data.imageWidth * scale;

        const height =
            data.imageHeight * scale;

        return {

            width,

            height,

            scale,

            offsetX:

                (data.frameWidth - width) / 2,

            offsetY:

                (data.frameHeight - height) / 2,

            crop:

                width > data.frameWidth ||

                height > data.frameHeight

        };

    }

}