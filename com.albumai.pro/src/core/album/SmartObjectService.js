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

        let sessionToken = null;
        if (typeof localFileSystem?.createSessionToken === "function") {
            try {
                sessionToken = await localFileSystem.createSessionToken(fileEntry);
            } catch (tokenError) {
                Logger.warn(`createSessionToken failed: ${tokenError?.message}`);
            }
        }

        const tokenPath = sessionToken || fileEntry.nativePath || fileEntry.name;
        if (!tokenPath) {
            throw new Error("Could not create a session token or path for the replacement source photo.");
        }

        // Query pre-replacement Smart Object properties to establish ground truth
        const preMetadata = await this.getSmartObjectProperties(layer.id, batchPlayOptions);
        const preFileReference = preMetadata?.fileReference || preMetadata?.smartObjectMore?.fileReference || null;

        const descriptors = [
            {
                _obj: "select",
                _target: [{ _ref: "layer", _id: layer.id }]
            },
            {
                _obj: "placedLayerReplaceContents",
                _target: [
                    {
                        _ref: "layer",
                        _enum: "ordinal",
                        _value: "targetEnum"
                    }
                ],
                null: {
                    _path: tokenPath,
                    _kind: "local"
                },
                _options: {
                    dialogOptions: "dontDisplay"
                }
            }
        ];

        const results = await this.batchPlay.execute(descriptors, batchPlayOptions);

        if (!Array.isArray(results) || results.length === 0) {
            throw new Error("Photoshop replacement operation returned no results.");
        }

        for (const res of results) {
            if (res?._obj === "error" || res?.error != null || res?.executionStatus === "failed") {
                throw new Error(res?.message || res?._message || res?.error || "Photoshop rejected smart object replacement.");
            }
        }

        const replaceResult = results.length > 1 ? results[1] : results[0];
        if (replaceResult?._obj === "error" || replaceResult?.executionStatus === "failed") {
            throw new Error(replaceResult?.message || "Photoshop rejected placedLayerReplaceContents.");
        }

        // Post-operation verification: check smart object descriptor facts if host supports it
        const postMetadata = await this.getSmartObjectProperties(layer.id, batchPlayOptions);
        const postFileReference = postMetadata?.fileReference || postMetadata?.smartObjectMore?.fileReference || null;

        if (preFileReference && postFileReference && preFileReference === postFileReference) {
            const photoName = fileEntry.name || "";
            if (photoName && !postFileReference.includes(photoName)) {
                throw new Error(`Photoshop smart object replacement did not update layer contents (still linked to '${preFileReference}').`);
            }
        }

        return true;
    }

    async getSmartObjectProperties(layerId, batchPlayOptions = {}) {
        try {
            const result = await this.batchPlay.command({
                _obj: "get",
                _target: [
                    { _property: "smartObject" },
                    { _ref: "layer", _id: layerId }
                ]
            }, {
                ...batchPlayOptions,
                commandName: "Get Smart Object Properties"
            });
            if (result?.smartObject) return result.smartObject;
        } catch (_) {}

        try {
            const resultMore = await this.batchPlay.command({
                _obj: "get",
                _target: [
                    { _property: "smartObjectMore" },
                    { _ref: "layer", _id: layerId }
                ]
            }, {
                ...batchPlayOptions,
                commandName: "Get Smart Object More"
            });
            if (resultMore?.smartObjectMore) return resultMore.smartObjectMore;
        } catch (_) {}

        return null;
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
