import Logger from "../photoshop/Logger";
import BatchPlay from "../photoshop/BatchPlay";

export default class LayerTransformService {

    constructor({

        batchPlay = BatchPlay

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async transform({

        layer,

        scaleX = 100,

        scaleY = 100,

        offsetX = 0,

        offsetY = 0,

        rotation = 0

    }) {

        if (!layer) {

            throw new Error(
                "Layer is required."
            );

        }

        Logger.info(

            `Transforming ${layer.name}`

        );

        await this.batchPlay.execute([

            {

                _obj: "transform",

                _target: [

                    {

                        _ref: "layer",

                        _id: layer.id

                    }

                ],

                freeTransformCenterState: {

                    _enum: "quadCenterState",

                    _value: "QCSAverage"

                },

                offset: {

                    _obj: "offset",

                    horizontal: {

                        _unit: "pixelsUnit",

                        _value: offsetX

                    },

                    vertical: {

                        _unit: "pixelsUnit",

                        _value: offsetY

                    }

                },

                width: {

                    _unit: "percentUnit",

                    _value: scaleX

                },

                height: {

                    _unit: "percentUnit",

                    _value: scaleY

                },

                angle: {

                    _unit: "angleUnit",

                    _value: rotation

                }

            }

        ]);

        return true;

    }

}