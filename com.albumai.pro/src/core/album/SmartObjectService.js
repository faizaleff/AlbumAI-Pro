import Logger from "../photoshop/Logger";
import BatchPlay from "../photoshop/BatchPlay";

export default class SmartObjectService {

    constructor({

        batchPlay = BatchPlay

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async replace({

        layer,

        image

    }) {

        if (!layer) {

            throw new Error(
                "Smart Object layer is required."
            );

        }

        if (!image) {

            throw new Error(
                "Image is required."
            );

        }

        Logger.info(

            `Replacing Smart Object: ${layer.name}`

        );

        await this.batchPlay.execute([

            {

                _obj: "select",

                _target: [

                    {

                        _ref: "layer",

                        _id: layer.id

                    }

                ],

                makeVisible: false

            },

            {

                _obj: "placedLayerReplaceContents",

                null: {

                    _path: image.nativePath,

                    _kind: "local"

                }

            }

        ]);

        return true;

    }

    async relink({

        layer,

        image

    }) {

        return this.replace({

            layer,

            image

        });

    }

}