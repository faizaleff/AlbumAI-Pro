import LayerManager from "../core/layers/LayerManager";

export default class TemplateLayerTreeReader {

    constructor({
        layerManager = new LayerManager()
    } = {}) {

        this.layerManager = layerManager;

    }

    read(document) {

        this.layerManager.scan(document);

        // LayerManager captures the live PSD id during the scan. Reuse that
        // value for every node so identity is consistent throughout one read.
        const documentId = this.layerManager.documentId;

        return this.layerManager.hierarchy().map(
            layer => this.toTemplateLayer(layer, null, documentId)
        );

    }

    clear() {

        this.layerManager.clear();

    }

    smartObjects() {

        return this.layerManager.smartObjects().map(layer => {

            const parentGroup = layer.parentId == null
                ? null
                : this.layerManager.byId(layer.parentId);

            return {
                documentId: layer.documentId,
                layerId: layer.id,
                parentGroupId: parentGroup?.id ?? null,
                parentGroupName: parentGroup?.name ?? null,
                layerName: layer.name,
                layerType: layer.kind,
                visible: !!layer.visible,
                locked: !!layer.locked,
                bounds: this.bounds(layer.bounds),

                // The current DOM layer path does not expose these values
                // reliably without Action Manager reads, so do not infer them.
                smartObjectType: null,
                linked: null
            };

        });

    }

    toTemplateLayer(layer, parentGroup, documentId) {

        return {
            // Normalized PSD identity fields used by subsequent template
            // processing. Layer ids are Photoshop's native layer ids; they
            // are never derived from the tree position or layer name.
            documentId,
            layerId: layer.id,
            parentGroupId: parentGroup?.id ?? null,
            parentGroupName: parentGroup?.name ?? null,
            layerName: layer.name,
            layerType: layer.kind,
            visible: !!layer.visible,
            locked: !!layer.locked,
            bounds: this.bounds(layer.bounds),

            // Keep the existing UI contract intact while consumers migrate to
            // the normalized field names.
            id: layer.id,
            name: layer.name,
            parentGroup: parentGroup?.name || null,
            children: (layer.children || []).map(child =>
                this.toTemplateLayer(child, layer, documentId)
            )
        };

    }

    bounds(bounds) {

        if (!bounds) {
            return null;
        }

        return {
            left: this.number(bounds.left),
            top: this.number(bounds.top),
            right: this.number(bounds.right),
            bottom: this.number(bounds.bottom)
        };

    }

    number(value) {

        if (typeof value === "number") {
            return value;
        }

        if (typeof value?.value === "number") {
            return value.value;
        }

        const number = Number(value);

        return Number.isFinite(number) ? number : null;

    }

}
