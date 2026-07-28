import Logger from "../photoshop/Logger";
import BatchPlay from "../photoshop/BatchPlay";
import { storage } from "uxp";
import { constants } from "photoshop";

export default class SmartObjectService {

    constructor({

        batchPlay = BatchPlay

    } = {}) {

        this.batchPlay = batchPlay;

    }

    async replace({

        layer,

        image,

        batchPlayOptions = {},

        sourcePhotoExists = null

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

        if (layer.id == null) {

            throw new Error(

                "Smart Object layer id is required."

            );

        }

        if (!image.nativePath) {

            throw new Error(

                "Image native path is required."

            );

        }

        const descriptors = [

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

        ];

        await this.batchPlay.execute(descriptors, batchPlayOptions);

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

    async replaceContentsWithFileEntry({

        layer,

        fileEntry,

        batchPlayOptions = {},

        sourcePhotoExists = null

    }) {

        if (!layer) {
            throw new Error("Smart Object layer is required.");
        }

        if (layer.id == null) {
            throw new Error("Smart Object layer id is required.");
        }

        if (!fileEntry) {
            throw new Error("Replacement source photo entry is required.");
        }

        const localFileSystem = storage.localFileSystem;

        if (typeof localFileSystem?.createSessionToken !== "function") {
            throw new Error("This Photoshop UXP runtime cannot create a session token.");
        }

        const sessionToken = await localFileSystem.createSessionToken(fileEntry);

        if (!sessionToken) {
            throw new Error("Could not create a session token for the replacement source photo.");
        }

        const descriptors = [
            {
                _obj: "select",
                _target: [{ _ref: "layer", _id: layer.id }],
                makeVisible: false
            },
            {
                _obj: "placedLayerReplaceContents",
                null: {
                    _path: sessionToken,
                    _kind: "local"
                }
            }
        ];

        await this.batchPlay.execute(descriptors, batchPlayOptions);

        return true;

    }

    async clipToBounds({

        document,

        layer,

        bounds,

        batchPlayOptions = {}

    }) {

        if (!document?.selection) {
            throw new Error("A parent Photoshop document selection is required for clipping.");
        }

        if (layer?.id == null) {
            throw new Error("Smart Object layer id is required for clipping.");
        }

        const hasUserMask = await this.hasUserMask(
            layer.id,
            batchPlayOptions
        );

        if (hasUserMask) {
            Logger.info("Reusing the existing Smart Object mask.");
            return;
        }

        await document.selection.selectRectangle({
            left: bounds.left,
            top: bounds.top,
            right: bounds.right,
            bottom: bounds.bottom
        }, constants.SelectionType.REPLACE);

        try {

            await this.batchPlay.command({
                _obj: "make",
                new: { _class: "channel" },
                at: {
                    _ref: "channel",
                    _enum: "channel",
                    _value: "mask"
                },
                using: {
                    _enum: "userMaskEnabled",
                    _value: "revealSelection"
                }
            }, {
                ...batchPlayOptions,
                commandName: "Clip Smart Object To Placeholder"
            });

        }

        finally {

            await document.selection.deselect();

        }

    }

    async hasUserMask(layerId, batchPlayOptions) {

        const result = await this.batchPlay.command({
            _obj: "get",
            _target: [
                { _property: "hasUserMask" },
                { _ref: "layer", _id: layerId }
            ]
        }, {
            ...batchPlayOptions,
            commandName: "Get Smart Object Mask"
        });

        return result?.hasUserMask === true;

    }

}
