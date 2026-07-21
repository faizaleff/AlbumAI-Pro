import BatchPlayService from "./BatchPlayService";
import Logger from "./Logger";

export default class TextLayerManager {

    constructor({

        batchPlay = new BatchPlayService()

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async get(layerId) {

        return this.batchPlay.get([

            {

                _ref: "textLayer",

                _id: layerId

            }

        ]);

    }

    async getText(layerId) {

        const result = await this.get(layerId);

        return result?.textKey || "";

    }

    async setText(layerId, text) {

        try {

            return await this.batchPlay.set(

                [

                    {

                        _ref: "textLayer",

                        _id: layerId

                    }

                ],

                {

                    _obj: "textLayer",

                    textKey: text

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async rename(layerId, name) {

        return this.batchPlay.rename(

            [

                {

                    _ref: "layer",

                    _id: layerId

                }

            ],

            name

        );

    }

    async setVisibility(layerId, visible) {

        if (visible) {

            return this.batchPlay.show([

                {

                    _ref: "layer",

                    _id: layerId

                }

            ]);

        }

        return this.batchPlay.hide([

            {

                _ref: "layer",

                _id: layerId

            }

        ]);

    }

    async duplicate(layerId, name = null) {

        return this.batchPlay.duplicate(

            [

                {

                    _ref: "layer",

                    _id: layerId

                }

            ],

            name

        );

    }

    async delete(layerId) {

        return this.batchPlay.delete(

            [

                {

                    _ref: "layer",

                    _id: layerId

                }

            ]

        );

    }

    async exists(layerId) {

        try {

            await this.get(layerId);

            return true;

        }

        catch {

            return false;

        }

    }

    async replaceTokens(layerId, values = {}) {

        let text = await this.getText(layerId);

        for (const key of Object.keys(values)) {

            text = text.replaceAll(

                `{${key}}`,

                values[key]

            );

        }

        return this.setText(

            layerId,

            text

        );

    }

}