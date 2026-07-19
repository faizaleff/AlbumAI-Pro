// src/core/smartobjects/SmartObjectReplacer.js

class SmartObjectReplacer {

    /**
     * @param {Object} photoshopAdapter
     * Adapter responsible for Photoshop-specific operations.
     */
    constructor(photoshopAdapter) {

        this.adapter = photoshopAdapter;

    }

    /**
     * Replace the current Smart Object contents.
     * Returns the newly placed layer.
     *
     * @param {File|Entry} imageFile
     */
    async replace(imageFile) {

        if (!imageFile)
            throw new Error("Image file is required.");

        await this.clear();

        const placedLayer =
            await this.adapter.placeImage(imageFile);

        return placedLayer;

    }

    /**
     * Remove existing editable artwork.
     */
    async clear() {

        const layers =
            await this.adapter.getEditableLayers();

        for (const layer of layers) {

            await this.adapter.deleteLayer(layer);

        }

    }

    /**
     * Append image without deleting existing layers.
     */
    async append(imageFile) {

        if (!imageFile)
            throw new Error("Image file is required.");

        return this.adapter.placeImage(imageFile);

    }

    /**
     * Replace multiple images.
     */
    async replaceMany(files = []) {

        const insertedLayers = [];

        for (const file of files) {

            insertedLayers.push(
                await this.replace(file)
            );

        }

        return insertedLayers;

    }

}

export default SmartObjectReplacer;