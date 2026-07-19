// src/core/layers/LayerScanner.js

class LayerScanner {

    /**
     * Scan an entire Photoshop document.
     * @param {Document} document
     * @returns {Array}
     */
    scan(document) {

        if (!document)
            throw new Error("Document is required.");

        return this.scanLayers(document.layers, null);

    }

    /**
     * Recursively scan layer collection.
     */
    scanLayers(layers, parent = null) {

        const result = [];

        if (!layers)
            return result;

        for (const layer of layers) {

            result.push(this.createNode(layer, parent));

            if (layer.layers?.length) {

                result.push(
                    ...this.scanLayers(
                        layer.layers,
                        layer.id
                    )
                );

            }

        }

        return result;

    }

    /**
     * Convert Photoshop layer into AlbumAI node.
     */
    createNode(layer, parentId) {

        return {

            id: layer.id,

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