import BatchPlayService from "./BatchPlayService";
import Logger from "./Logger";

export default class SelectionManager {

    constructor({

        batchPlay = new BatchPlayService()

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async selectLayer(layerId) {

        try {

            return await this.batchPlay.select([

                {

                    _ref: "layer",

                    _id: layerId

                }

            ]);

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async selectLayers(layerIds = []) {

        try {

            const target = layerIds.map(id => ({

                _ref: "layer",

                _id: id

            }));

            return await this.batchPlay.select(

                target

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async deselectLayers() {

        try {

            return await this.batchPlay.executeSingle({

                _obj: "selectNoLayers"

            });

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async selectAllLayers() {

        try {

            return await this.batchPlay.executeSingle({

                _obj: "selectAllLayers"

            });

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async invertSelection() {

        try {

            return await this.batchPlay.executeSingle({

                _obj: "inverse"

            });

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async selectPixels(layerId) {

        try {

            return await this.batchPlay.executeSingle({

                _obj: "set",

                _target: [

                    {

                        _ref: "channel",

                        _property: "selection"

                    }

                ],

                to: {

                    _ref: "channel",

                    _enum: "channel",

                    _value: "transparencyEnum"

                }

            });

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async clearSelection() {

        try {

            return await this.batchPlay.executeSingle({

                _obj: "set",

                _target: [

                    {

                        _ref: "channel",

                        _property: "selection"

                    }

                ],

                to: {

                    _enum: "ordinal",

                    _ref: "none"

                }

            });

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async getSelectionBounds() {

        try {

            return await this.batchPlay.get([

                {

                    _property: "selection"

                },

                {

                    _ref: "document",

                    _enum: "ordinal",

                    _value: "targetEnum"

                }

            ]);

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async hasSelection() {

        try {

            const selection =

                await this.getSelectionBounds();

            return !!selection;

        }

        catch {

            return false;

        }

    }

}