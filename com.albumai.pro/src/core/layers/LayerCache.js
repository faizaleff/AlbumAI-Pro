// src/core/layers/LayerCache.js

class LayerCache {

    constructor() {
        this.clear();
    }

    /**
     * Build cache from scanned nodes.
     * @param {Array} nodes
     */
    build(nodes = []) {

        this.clear();

        for (const node of nodes) {

            this.byIdMap.set(node.id, node);

            // ---------- Name Index ----------

            if (!this.byNameMap.has(node.name)) {
                this.byNameMap.set(node.name, []);
            }

            this.byNameMap
                .get(node.name)
                .push(node);

            // ---------- Kind Index ----------

            if (!this.byKindMap.has(node.kind)) {
                this.byKindMap.set(node.kind, []);
            }

            this.byKindMap
                .get(node.kind)
                .push(node);

            // ---------- Parent Index ----------

            if (!this.byParentMap.has(node.parentId)) {
                this.byParentMap.set(node.parentId, []);
            }

            this.byParentMap
                .get(node.parentId)
                .push(node);

        }

        this.nodeCount = nodes.length;

        return this;

    }

    /**
     * Lookup by layer ID.
     */
    byId(id) {
        return this.byIdMap.get(id) || null;
    }

    /**
     * Lookup by layer name.
     */
    byName(name) {
        return this.byNameMap.get(name) || [];
    }

    /**
     * Lookup by layer kind.
     */
    byKind(kind) {
        return this.byKindMap.get(kind) || [];
    }

    /**
     * Lookup direct children.
     */
    children(parentId) {
        return this.byParentMap.get(parentId) || [];
    }

    /**
     * Check cache.
     */
    has(id) {
        return this.byIdMap.has(id);
    }

    /**
     * Number of cached layers.
     */
    count() {
        return this.nodeCount;
    }

    /**
     * Return all layers.
     */
    all() {
        return [...this.byIdMap.values()];
    }

    /**
     * Clear cache.
     */
    clear() {

        this.byIdMap = new Map();
        this.byNameMap = new Map();
        this.byKindMap = new Map();
        this.byParentMap = new Map();

        this.nodeCount = 0;

    }

    /**
     * Cache statistics.
     */
    stats() {

        return {

            layers: this.nodeCount,

            uniqueNames: this.byNameMap.size,

            layerTypes: this.byKindMap.size,

            parentGroups: this.byParentMap.size

        };

    }

}

export default LayerCache;