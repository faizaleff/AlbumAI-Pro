import BatchPlayService from "./BatchPlayService";
import Logger from "./Logger";

export default class ImageTransformService {

    constructor({

        batchPlay = new BatchPlayService()

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async transform({

        layerId,

        scale = 100,

        offsetX = 0,

        offsetY = 0,

        rotation = 0

    }) {

        if (!layerId) {

            throw new Error(

                "Layer ID is required."

            );

        }

        try {

            return await this.batchPlay.executeSingle({

                _obj: "transform",

                _target: [

                    {

                        _ref: "layer",

                        _id: layerId

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

                    _value: scale

                },

                height: {

                    _unit: "percentUnit",

                    _value: scale

                },

                angle: {

                    _unit: "angleUnit",

                    _value: rotation

                }

            });

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async scale(layerId, percent) {

        return this.transform({

            layerId,

            scale: percent

        });

    }

    async move(

        layerId,

        x,

        y

    ) {

        return this.transform({

            layerId,

            offsetX: x,

            offsetY: y

        });

    }

    async rotate(

        layerId,

        angle

    ) {

        return this.transform({

            layerId,

            rotation: angle

        });

    }

    async fit(

        layerId,

        fitResult

    ) {

        return this.transform({

            layerId,

            scale:

                fitResult.scale * 100,

            offsetX:

                fitResult.offsetX,

            offsetY:

                fitResult.offsetY

        });

    }

    async reset(layerId) {

        return this.transform({

            layerId,

            scale: 100,

            offsetX: 0,

            offsetY: 0,

            rotation: 0

        });

    }

}