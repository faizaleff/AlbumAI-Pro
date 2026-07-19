// src/core/smartobjects/SmartObjectTransform.js

class SmartObjectTransform {

    /**
     * @param {Object} photoshopAdapter
     * Adapter responsible for Photoshop transform operations.
     */
    constructor(photoshopAdapter) {

        this.adapter = photoshopAdapter;

    }

    /**
     * Fit image completely inside the canvas.
     */
    async fit(layer, imageBounds, canvasBounds) {

        const scale = Math.min(
            canvasBounds.width / imageBounds.width,
            canvasBounds.height / imageBounds.height
        );

        return this.apply(layer, imageBounds, canvasBounds, scale);

    }

    /**
     * Fill the entire canvas.
     */
    async fill(layer, imageBounds, canvasBounds) {

        const scale = Math.max(
            canvasBounds.width / imageBounds.width,
            canvasBounds.height / imageBounds.height
        );

        return this.apply(layer, imageBounds, canvasBounds, scale);

    }

    /**
     * Stretch image to canvas.
     */
    async stretch(layer, canvasBounds) {

        await this.adapter.transform(layer, {

            scaleX: 100,
            scaleY: 100,

            width: canvasBounds.width,
            height: canvasBounds.height,

            x: canvasBounds.centerX,
            y: canvasBounds.centerY

        });

    }

    /**
     * Center without scaling.
     */
    async center(layer, imageBounds, canvasBounds) {

        await this.adapter.move(layer, {

            x: canvasBounds.centerX - imageBounds.centerX,
            y: canvasBounds.centerY - imageBounds.centerY

        });

    }

    /**
     * Generic transform.
     */
    async apply(layer, imageBounds, canvasBounds, scale) {

        const scaledWidth =
            imageBounds.width * scale;

        const scaledHeight =
            imageBounds.height * scale;

        const offsetX =
            canvasBounds.centerX -
            scaledWidth / 2;

        const offsetY =
            canvasBounds.centerY -
            scaledHeight / 2;

        await this.adapter.transform(layer, {

            scaleX: scale * 100,
            scaleY: scale * 100,

            x: offsetX,
            y: offsetY

        });

    }

    /**
     * Align layer.
     */
    async align(layer, position, imageBounds, canvasBounds) {

        let x = imageBounds.left;
        let y = imageBounds.top;

        switch (position) {

            case "top":
                y = 0;
                break;

            case "bottom":
                y = canvasBounds.height - imageBounds.height;
                break;

            case "left":
                x = 0;
                break;

            case "right":
                x = canvasBounds.width - imageBounds.width;
                break;

            case "center":
                x = canvasBounds.centerX - imageBounds.width / 2;
                y = canvasBounds.centerY - imageBounds.height / 2;
                break;

        }

        await this.adapter.move(layer, { x, y });

    }

}

export default SmartObjectTransform;