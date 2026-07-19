// src/core/smartobjects/SmartObjectResolver.js

class SmartObjectResolver {

    constructor(layerManager) {

        this.layerManager = layerManager;

    }

    /**
     * Resolve Smart Object by layer ID.
     */
    byId(layerId) {

        const layer = this.layerManager.byId(layerId);

        return this.validate(layer);

    }

    /**
     * Resolve by exact layer name.
     */
    byName(name) {

        const layers = this.layerManager.byName(name);

        return layers
            .map(layer => this.validate(layer))
            .filter(Boolean);

    }

    /**
     * Resolve all Smart Objects.
     */
    all() {

        return this.layerManager.smartObjects();

    }

    /**
     * Resolve first matching Smart Object.
     */
    first(predicate) {

        return this.all().find(predicate) || null;

    }

    /**
     * Resolve multiple matches.
     */
    where(predicate) {

        return this.all().filter(predicate);

    }

    /**
     * Validate Smart Object.
     */
    validate(layer) {

        if (!layer)
            return null;

        if (layer.kind !== "smartObject")
            return null;

        return layer;

    }

    /**
     * Check whether a layer is a Smart Object.
     */
    isSmartObject(layer) {

        return !!this.validate(layer);

    }

    /**
     * Count Smart Objects.
     */
    count() {

        return this.all().length;

    }

}

export default SmartObjectResolver;