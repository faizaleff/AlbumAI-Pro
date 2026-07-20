// src/core/layers/LayerInfo.js

class LayerInfo {

    /**
     * Create standardized layer metadata.
     * @param {Object} node
     * @returns {Object}
     */
    create(node) {

        if (!node)
            return null;

        return {

            id: node.id,

            documentId: node.documentId,

            name: node.name,

            parentId: node.parentId,

            kind: node.kind,

            visible: node.visible,

            locked: node.locked,

            opacity: node.opacity,

            blendMode: node.blendMode,

            bounds: this.normalizeBounds(node.bounds),

            hasChildren: node.hasChildren,

            childCount: node.childCount,

            width: this.width(node.bounds),

            height: this.height(node.bounds),

            area: this.area(node.bounds),

            photoshopLayer: node.photoshopLayer

        };

    }

    normalizeBounds(bounds) {

        if (!bounds)
            return null;

        return {
            left: Number(bounds.left ?? 0),
            top: Number(bounds.top ?? 0),
            right: Number(bounds.right ?? 0),
            bottom: Number(bounds.bottom ?? 0)
        };

    }

    width(bounds) {

        if (!bounds)
            return 0;

        return Number(bounds.right) - Number(bounds.left);

    }

    height(bounds) {

        if (!bounds)
            return 0;

        return Number(bounds.bottom) - Number(bounds.top);

    }

    area(bounds) {

        return this.width(bounds) * this.height(bounds);

    }

    center(bounds) {

        if (!bounds)
            return null;

        return {

            x:
                Number(bounds.left) +
                this.width(bounds) / 2,

            y:
                Number(bounds.top) +
                this.height(bounds) / 2

        };

    }

    isSmartObject(node) {

        return node.kind === "smartObject";

    }

    isGroup(node) {

        return node.hasChildren;

    }

    isText(node) {

        return node.kind === "textLayer";

    }

    isPixel(node) {

        return node.kind === "pixel";

    }

    isVisible(node) {

        return node.visible;

    }

}

export default LayerInfo;
