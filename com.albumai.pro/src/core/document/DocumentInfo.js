// src/core/document/DocumentInfo.js

class DocumentInfo {

    /**
     * Extract normalized document information.
     * @param {Document} document
     * @returns {Object}
     */
    get(document) {

        if (!document) {
            throw new Error("Document is required.");
        }

        return {

            id: document.id,

            title: document.title,

            width: this.number(document.width),

            height: this.number(document.height),

            resolution: document.resolution ?? null,

            colorMode: document.mode ?? null,

            bitsPerChannel: document.bitsPerChannel ?? null,

            layerCount: this.layerCount(document),

            hasBackgroundLayer: this.hasBackground(document),

            isSaved: document.saved ?? false,

            path: document.path ?? null

        };

    }

    /**
     * Returns a short summary string.
     */
    summary(document) {

        const info = this.get(document);

        return {

            name: info.title,

            size: `${info.width} × ${info.height}`,

            resolution: info.resolution,

            layers: info.layerCount,

            colorMode: info.colorMode,

            saved: info.isSaved

        };

    }

    /**
     * Width/Height normalization.
     */
    number(value) {

        if (value == null)
            return null;

        if (typeof value === "number")
            return value;

        if (typeof value.value === "number")
            return value.value;

        return Number(value);

    }

    /**
     * Layer count.
     */
    layerCount(document) {

        if (!document.layers)
            return 0;

        return document.layers.length;

    }

    /**
     * Background layer detection.
     */
    hasBackground(document) {

        if (!document.layers?.length)
            return false;

        const first = document.layers[0];

        return !!(
            first &&
            (
                first.isBackgroundLayer ||
                first.kind === "background"
            )
        );

    }

}

export default DocumentInfo;