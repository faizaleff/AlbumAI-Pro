import LayerManager from "../core/layers/LayerManager";

export default class TemplateLayerTreeReader {

    constructor({
        layerManager = new LayerManager()
    } = {}) {

        this.layerManager = layerManager;

    }

    read(document) {

        this.layerManager.scan(document);

        return this.layerManager.hierarchy().map(
            layer => this.toTemplateLayer(layer, null)
        );

    }

    toTemplateLayer(layer, parentGroup) {

        return {
            id: layer.id,
            name: layer.name,
            parentGroup: parentGroup?.name || null,
            layerType: layer.kind,
            visible: !!layer.visible,
            locked: !!layer.locked,
            bounds: this.bounds(layer.bounds),
            children: (layer.children || []).map(child =>
                this.toTemplateLayer(child, layer)
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
