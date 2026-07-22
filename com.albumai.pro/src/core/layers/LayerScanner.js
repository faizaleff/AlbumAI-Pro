// src/core/layers/LayerScanner.js

import Logger from "../photoshop/Logger";

class LayerScanner {

    /**
     * Scan an entire Photoshop document.
     * @param {Document} document
     * @returns {Array}
     */
    scan(document) {

        if (!document)
            throw new Error("Document is required.");

        Logger.info("Replacement trace: LayerScanner before document.layers");
        const layers = document.layers;
        Logger.info("Replacement trace: LayerScanner after document.layers");

        return this.scanLayers(layers, null, document.id);

    }

    /**
     * Recursively scan layer collection.
     */
    scanLayers(layers, parent = null, documentId = null) {

        const result = [];

        if (!layers)
            return result;

        for (const layer of layers) {

            result.push(this.createNode(layer, parent, documentId));

            if (layer.layers?.length) {

                result.push(
                    ...this.scanLayers(
                        layer.layers,
                        layer.id,
                        documentId
                    )
                );

            }

        }

        return result;

    }

    /**
     * Convert Photoshop layer into AlbumAI node.
     */
    createNode(layer, parentId, documentId) {

        return {

            id: layer.id,

            documentId,

            parentId,

            name: layer.name,

            kind: layer.kind,

            visible: layer.visible,

            locked: layer.locked,

            opacity: layer.opacity,

            blendMode: layer.blendMode,

            bounds: layer.bounds,

            hasChildren:
                layer.layers?.length > 0,

            childCount:
                layer.layers?.length || 0,

            children: [],

            photoshopLayer: layer

        };

    }

    /**
     * Build hierarchy.
     */
    buildTree(nodes) {

        const lookup = new Map();

        nodes.forEach(node => {

            lookup.set(node.id, node);

        });

        const roots = [];

        nodes.forEach(node => {

            if (node.parentId == null) {

                roots.push(node);

                return;

            }

            const parent =
                lookup.get(node.parentId);

            if (parent) {

                parent.children.push(node);

            }

        });

        return roots;

    }

}

export default LayerScanner;
