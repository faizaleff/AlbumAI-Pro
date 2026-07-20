import Logger from "../photoshop/Logger";

export default class LayerBoundsService {

    get(layer) {

        if (!layer) {

            throw new Error(
                "Layer is required."
            );

        }

        const bounds = layer.bounds;

        if (!bounds) {

            throw new Error(

                `Layer bounds are required: ${layer.name || layer.id}`

            );

        }

        const left =
            Number(bounds.left);

        const top =
            Number(bounds.top);

        const right =
            Number(bounds.right);

        const bottom =
            Number(bounds.bottom);

        if (

            !Number.isFinite(left) ||

            !Number.isFinite(top) ||

            !Number.isFinite(right) ||

            !Number.isFinite(bottom)

        ) {

            throw new Error(

                `Layer bounds are invalid: ${layer.name || layer.id}`

            );

        }

        const width =
            right - left;

        const height =
            bottom - top;

        if (width < 0 || height < 0) {

            throw new Error(

                `Layer bounds are inverted: ${layer.name || layer.id}`

            );

        }

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
