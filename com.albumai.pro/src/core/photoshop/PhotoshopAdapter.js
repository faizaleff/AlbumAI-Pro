// ============================================================================
// File: src/core/photoshop/PhotoshopAdapter.js
// AlbumAI Pro
// ============================================================================

import { app, core } from "photoshop";

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

        return core.executeAsModal(
            () => app.open(file),
            { commandName: "Open Album Document" }
        );

    }

    async save(document = this.activeDocument()) {

        if (!document)
            throw new Error("No active document.");

        Logger.info(`Saving ${document.title}`);

        await core.executeAsModal(
            () => document.save(),
            { commandName: "Save Album Document" }
        );

        return document;

    }

    async close(document, options = {}) {

        if (!document)
            return;

        Logger.info(`Closing ${document.title}`);

        const { save = false } = typeof options === "boolean" ? { save: options } : options;

        await core.executeAsModal(async () => {
            if (save && !document.saved) await document.save();
            await document.close({ save: false });
        }, { commandName: "Close Album Document" });

    }

    async activate(document) {

        if (!document)
            throw new Error("Document is required.");

        await core.executeAsModal(() => {
            app.activeDocument = document;
        }, { commandName: "Activate Album Document" });

        return document;

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

        await core.executeAsModal(
            () => layer.editContents(),
            { commandName: "Open Smart Object" }
        );

        return app.activeDocument;

    }

    async placeImage(imageFile) {

        if (!imageFile)
            throw new Error("Image file required.");

        const document =
            this.activeDocument();

        await core.executeAsModal(
            () => document.place(imageFile),
            { commandName: "Place Smart Object Image" }
        );

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
