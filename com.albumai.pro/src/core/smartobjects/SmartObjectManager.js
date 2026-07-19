// src/core/smartobjects/SmartObjectManager.js

import SmartObjectScanner from "./SmartObjectScanner";
import SmartObjectResolver from "./SmartObjectResolver";
import SmartObjectEditor from "./SmartObjectEditor";
import SmartObjectReplacer from "./SmartObjectReplacer";
import SmartObjectTransform from "./SmartObjectTransform";
import SmartObjectHistory from "./SmartObjectHistory";

class SmartObjectManager {

    constructor({
        layerManager,
        photoshopAdapter
    }) {

        this.scanner = new SmartObjectScanner();

        this.resolver =
            new SmartObjectResolver(layerManager);

        this.editor =
            new SmartObjectEditor();

        this.replacer =
            new SmartObjectReplacer(
                photoshopAdapter
            );

        this.transform =
            new SmartObjectTransform(
                photoshopAdapter
            );

        this.history =
            new SmartObjectHistory(
                this.editor
            );

    }

    /**
     * Scan all Smart Objects.
     */
    scan(nodes) {

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

        return layer.bounds;

    }

    /**
     * Placeholder.
     */
    async getCanvasBounds(document) {

        return {

            width: document.width,

            height: document.height,

            centerX: document.width / 2,

            centerY: document.height / 2

        };

    }

}

export default SmartObjectManager;