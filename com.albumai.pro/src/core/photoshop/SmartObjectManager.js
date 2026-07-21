import { core } from "photoshop";
import BatchPlayService from "./BatchPlayService";
import Logger from "./Logger";

export default class SmartObjectManager {

    constructor({

        batchPlay = new BatchPlayService()

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async open(layerId) {

        try {

            await core.executeAsModal(

                async () => {

                    await this.batchPlay.select([

                        {

                            _ref: "layer",

                            _id: layerId

                        }

                    ]);

                    await this.batchPlay.executeSingle({

                        _obj: "placedLayerEditContents"

                    });

                },

                {

                    commandName:

                        "Open Smart Object"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async replaceContents(fileToken) {

        try {

            await core.executeAsModal(

                async () => {

                    await this.batchPlay.executeSingle({

                        _obj: "placedLayerReplaceContents",

                        null: {

                            _path: fileToken,

                            _kind: "local"

                        }

                    });

                },

                {

                    commandName:

                        "Replace Smart Object"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async save() {

        try {

            await core.executeAsModal(

                async () => {

                    await this.batchPlay.executeSingle({

                        _obj: "save"

                    });

                },

                {

                    commandName:

                        "Save Smart Object"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async close() {

        try {

            await core.executeAsModal(

                async () => {

                    await this.batchPlay.executeSingle({

                        _obj: "close",

                        saving: "yes"

                    });

                },

                {

                    commandName:

                        "Close Smart Object"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async replace({

        layerId,

        fileToken

    }) {

        await this.open(layerId);

        await this.replaceContents(fileToken);

        await this.save();

        await this.close();

    }

}