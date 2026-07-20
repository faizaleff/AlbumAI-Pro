import Logger from "../photoshop/Logger";

export default class LayerBoundsService {

    get(layer) {

        if (!layer) {

            throw new Error(
                "Layer is required."
            );

        }

        const bounds = layer.bounds;

        const left =
            Number(bounds.left);

        const top =
            Number(bounds.top);

        const right =
            Number(bounds.right);

        const bottom =
            Number(bounds.bottom);

        const width =
            right - left;

        const height =
            bottom - top;

        const centerX =
            left + width / 2;

        const centerY =
            top + height / 2;

        const result = {

            left,

            top,

            right,

            bottom,

            width,

            height,

            centerX,

            centerY

        };

        Logger.info(

            `Bounds calculated for ${layer.name}`

        );

        return result;

    }

    getCenter(layer) {

        const bounds =
            this.get(layer);

        return {

            x: bounds.centerX,

            y: bounds.centerY

        };

    }

    getSize(layer) {

        const bounds =
            this.get(layer);

        return {

            width: bounds.width,

            height: bounds.height

        };

    }

}