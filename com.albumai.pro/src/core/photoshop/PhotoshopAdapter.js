// ============================================================================
// File: src/core/photoshop/PhotoshopAdapter.js
// AlbumAI Pro
// ============================================================================

import { app } from "photoshop";

import BatchPlay from "./BatchPlay";
import Logger from "./Logger";

class PhotoshopAdapter {

    // ---------------------------------------------------------------------
    // DOCUMENTS
    // ---------------------------------------------------------------------

    activeDocument() {

        return app.activeDocument ?? null;

    }

    documents() {

        return [...app.documents];

    }

    async open(file) {

        if (!file)
            throw new Error("File is required.");

        Logger.info(`Opening ${file.name}`);

        return await app.open(file);

    }

    async save(document = this.activeDocument()) {

        if (!document)
            throw new Error("No active document.");

        Logger.info(`Saving ${document.title}`);

        await document.save();

        return document;

    }

    async close(document, save = true) {

        if (!document)
            return;

        Logger.info(`Closing ${document.title}`);

        await document.close({

            save

        });

    }

    async activate(document) {

        if (!document)
            throw new Error("Document is required.");

        app.activeDocument = document;

    }

    // ---------------------------------------------------------------------
    // LAYERS
    // ---------------------------------------------------------------------

    async selectLayer(layer) {

        if (!layer)
            throw new Error("Layer is required.");

        return BatchPlay.selectLayer(layer.id);

    }

    async deleteLayer(layer) {

        await this.selectLayer(layer);

        return BatchPlay.deleteSelectedLayer();

    }

    async getEditableLayers() {

        const document = this.activeDocument();

        if (!document)
            return [];

        return document.layers.filter(layer => {

            if (layer.locked)
                return false;

            if (
                layer.kind === "background"
            )
                return false;

            return true;

        });

    }

    // ---------------------------------------------------------------------
    // SMART OBJECTS
    // ---------------------------------------------------------------------

    async editSmartObject(layer) {

        if (!layer)
            throw new Error("Layer required.");

        await layer.editContents();

        return app.activeDocument;

    }

    async placeImage(imageFile) {

        if (!imageFile)
            throw new Error("Image file required.");

        const document =
            this.activeDocument();

        await document.place(imageFile);

        return document.activeLayers[0];

    }

    // ---------------------------------------------------------------------
    // TRANSFORMS
    // ---------------------------------------------------------------------

    async move(layer, { x = 0, y = 0 }) {

        await this.selectLayer(layer);

        return BatchPlay.transform({

            offsetX: x,

            offsetY: y

        });

    }

    async transform(layer, options = {}) {

        await this.selectLayer(layer);

        return BatchPlay.transform({

            scaleX:
                options.scaleX ?? 100,

            scaleY:
                options.scaleY ?? 100,

            offsetX:
                options.x ?? 0,

            offsetY:
                options.y ?? 0,

            angle:
                options.angle ?? 0

        });

    }

}

export default PhotoshopAdapter;