import BatchPlayService from "./BatchPlayService";
import Logger from "./Logger";

export default class LayerManager {

    constructor({

        batchPlay = new BatchPlayService()

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async findById(layerId) {

        return this.batchPlay.get([

            {

                _ref: "layer",

                _id: layerId

            }

        ]);

    }

    async findByName(name) {

        return this.batchPlay.get([

            {

                _ref: "layer",

                _name: name

            }

        ]);

    }

    async select(layerId) {

        return this.batchPlay.select([

            {

                _ref: "layer",

                _id: layerId

            }

        ]);

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

    async show(layerId) {

        return this.batchPlay.show([

            {

                _ref: "layer",

                _id: layerId

            }

        ]);

    }

    async hide(layerId) {

        return this.batchPlay.hide([

            {

                _ref: "layer",

                _id: layerId

            }

        ]);

    }

    async delete(layerId) {

        return this.batchPlay.delete([

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

    async lock(layerId) {

        return this.batchPlay.set(

            [

                {

                    _ref: "layer",

                    _id: layerId

                }

            ],

            {

                _obj: "layer",

                layerLocking: {

                    protectAll: true

                }

            }

        );

    }

    async unlock(layerId) {

        return this.batchPlay.set(

            [

                {

                    _ref: "layer",

                    _id: layerId

                }

            ],

            {

                _obj: "layer",

                layerLocking: {

                    protectAll: false

                }

            }

        );

    }

    async setVisibility(layerId, visible) {

        return visible

            ? this.show(layerId)

            : this.hide(layerId);

    }

    async exists(layerId) {

        try {

            await this.findById(layerId);

            return true;

        }

        catch {

            return false;

        }

    }

    async getProperties(layerId) {

        try {

            return await this.findById(layerId);

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

}