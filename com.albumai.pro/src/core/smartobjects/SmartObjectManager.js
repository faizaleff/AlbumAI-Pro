// src/core/smartobjects/SmartObjectManager.js

import SmartObjectScanner from "./SmartObjectScanner";
import SmartObjectResolver from "./SmartObjectResolver";
import SmartObjectEditor from "./SmartObjectEditor";
import SmartObjectReplacer from "./SmartObjectReplacer";
import SmartObjectTransform from "./SmartObjectTransform";
import SmartObjectHistory from "./SmartObjectHistory";
import PhotoshopAdapter from "../photoshop/PhotoshopAdapter";
import { app } from "photoshop";

class SmartObjectManager {

    constructor({
        layerManager,
        photoshopAdapter
    } = {}) {

        this.layerManager = layerManager;

        this.scanner = new SmartObjectScanner();

        this.resolver =
            new SmartObjectResolver(layerManager);

        this.editor =
            new SmartObjectEditor();

        this.replacer =
            new SmartObjectReplacer(
                photoshopAdapter || new PhotoshopAdapter()
            );

        this.transform =
            new SmartObjectTransform(
                photoshopAdapter || new PhotoshopAdapter()
            );

        this.history =
            new SmartObjectHistory(
                this.editor
            );

    }

    /**
     * Scan all Smart Objects.
     */
    scan(documentOrNodes) {

        const nodes = Array.isArray(documentOrNodes)
            ? documentOrNodes
            : this.layerManager?.scan(documentOrNodes) || [];

        return this.scanner.scan(nodes);

    }

    /**
     * Replace Smart Object contents.
     */
    async replace({

        layerId,

        imageFile,

        mode = "fill"

    }) {

        const layer =
            this.resolver.byId(layerId);

        if (!layer)
            throw new Error(
                `Smart Object ${layerId} not found.`
        );

        if (layer.documentId != null && app.activeDocument?.id !== layer.documentId) {
            throw new Error("The Smart Object belongs to a document that is not active. Activate and rescan the template before replacing contents.");
        }

        return this.history.execute(async () => {

            const smartDocument =
                await this.editor.open(
                    layer.photoshopLayer
                );

            const insertedLayer =
                await this.replacer.replace(
                    imageFile
                );

            const imageBounds =
                await this.getImageBounds(
                    insertedLayer
                );

            const canvasBounds =
                await this.getCanvasBounds(
                    smartDocument
                );

            switch (mode) {

                case "fit":

                    await this.transform.fit(
                        insertedLayer,
                        imageBounds,
                        canvasBounds
                    );

                    break;

                case "fill":

                    await this.transform.fill(
                        insertedLayer,
                        imageBounds,
                        canvasBounds
                    );

                    break;

                case "center":

                    await this.transform.center(
                        insertedLayer,
                        imageBounds,
                        canvasBounds
                    );

                    break;

                default:

                    throw new Error(
                        `Unsupported mode: ${mode}`
                    );

            }

            return insertedLayer;

        });

    }

    /**
     * Replace multiple Smart Objects.
     */
    async replaceMany(jobs = []) {

        const results = [];

        for (const job of jobs) {

            results.push(
                await this.replace(job)
            );

        }

        return results;

    }

    /**
     * Placeholder.
     * Implement using Photoshop DOM / BatchPlay.
     */
    async getImageBounds(layer) {

        const bounds = layer?.bounds;

        if (!bounds) {
            throw new Error("Placed image bounds are unavailable.");
        }

        const left = Number(bounds.left);
        const top = Number(bounds.top);
        const right = Number(bounds.right);
        const bottom = Number(bounds.bottom);

        if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
            throw new Error("Placed image bounds are invalid.");
        }

        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
            centerX: (left + right) / 2,
            centerY: (top + bottom) / 2
        };

    }

    /**
     * Placeholder.
     */
    async getCanvasBounds(document) {

        const width = Number(document?.width);
        const height = Number(document?.height);

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new Error("Smart Object canvas dimensions are invalid.");
        }

        return { width, height, centerX: width / 2, centerY: height / 2 };

    }

}

export default SmartObjectManager;
