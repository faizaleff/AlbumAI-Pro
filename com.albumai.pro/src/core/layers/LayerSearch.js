// src/core/layers/LayerSearch.js

class LayerSearch {

    constructor(cache) {
        this.cache = cache;
    }

    /**
     * Find layer by ID.
     */
    byId(id) {
        return this.cache.byId(id);
    }

    /**
     * Find layers by exact name.
     */
    byName(name) {
        return this.cache.byName(name);
    }

    /**
     * Find layers by kind.
     */
    byKind(kind) {
        return this.cache.byKind(kind);
    }

    /**
     * Find direct children.
     */
    children(parentId) {
        return this.cache.children(parentId);
    }

    /**
     * Find using regular expression.
     */
    byRegex(regex) {

        return this.cache
            .all()
            .filter(layer => regex.test(layer.name));

    }

    /**
     * Find visible layers.
     */
    visible() {

        return this.cache
            .all()
            .filter(layer => layer.visible);

    }

    /**
     * Hidden layers.
     */
    hidden() {

        return this.cache
            .all()
            .filter(layer => !layer.visible);

    }

    /**
     * Locked layers.
     */
    locked() {

        return this.cache
            .all()
            .filter(layer => layer.locked);

    }

    /**
     * Unlocked layers.
     */
    unlocked() {

        return this.cache
            .all()
            .filter(layer => !layer.locked);

    }

    /**
     * Find by opacity.
     */
    byOpacity(value) {

        return this.cache
            .all()
            .filter(layer => layer.opacity === value);

    }

    /**
     * Find by blend mode.
     */
    byBlendMode(mode) {

        return this.cache
            .all()
            .filter(layer => layer.blendMode === mode);

    }

    /**
     * Find descendants recursively.
     */
    descendants(parentId) {

        const result = [];

        const walk = id => {

            const children = this.children(id);

            for (const child of children) {

                result.push(child);

                walk(child.id);

            }

        };

        walk(parentId);

        return result;

    }

    /**
     * Find ancestor chain.
     */
    ancestors(layerId) {

        const result = [];

        let current = this.byId(layerId);

        while (current && current.parentId !== null) {

            current = this.byId(current.parentId);

            if (current) {

                result.push(current);

            }

        }

        return result;

    }

    /**
     * Predicate search.
     */
    where(predicate) {

        return this.cache
            .all()
            .filter(predicate);

    }

}

export default LayerSearch;