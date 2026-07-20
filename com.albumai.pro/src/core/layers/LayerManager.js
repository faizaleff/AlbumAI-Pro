// src/core/layers/LayerManager.js

import LayerScanner from "./LayerScanner";
import LayerCache from "./LayerCache";
import LayerSearch from "./LayerSearch";
import LayerInfo from "./LayerInfo";
import LayerTree from "./LayerTree";

class LayerManager {

    constructor() {

        this.cache = new LayerCache();
        this.search = new LayerSearch(this.cache);
        this.info = new LayerInfo();
        this.tree = new LayerTree();
        this.scanner = new LayerScanner();

        this.nodes = [];
        this.roots = [];
        this.documentId = null;

    }

    /**
     * Scan document and build indexes.
     */
    scan(document) {

        if (!document?.id) {
            throw new Error("A live Photoshop document is required to scan layers.");
        }

        this.nodes = this.scanner.scan(document);
        this.documentId = document.id;

        this.cache.build(this.nodes);

        this.roots =
            this.tree.build(this.nodes);

        return this.nodes;

    }

    /**
     * Refresh from active document.
     */
    refresh(document) {

        return this.scan(document);

    }

    /**
     * Find layer by ID.
     */
    byId(id) {

        return this.search.byId(id);

    }

    /**
     * Find by exact name.
     */
    byName(name) {

        return this.search.byName(name);

    }

    /**
     * Find Smart Objects.
     */
    smartObjects() {

        return this.search.byKind(
            "smartObject"
        );

    }

    /**
     * Find groups.
     */
    groups() {

        return this.search.where(
            layer => layer.hasChildren
        );

    }

    /**
     * Visible layers.
     */
    visible() {

        return this.search.visible();

    }

    /**
     * Hidden layers.
     */
    hidden() {

        return this.search.hidden();

    }

    /**
     * Root hierarchy.
     */
    hierarchy() {

        return this.roots;

    }

    /**
     * Flat list.
     */
    all() {

        return this.nodes;

    }

    /**
     * Metadata.
     */
    metadata(layerId) {

        const node =
            this.byId(layerId);

        if (!node)
            return null;

        return this.info.create(node);

    }

    /**
     * Tree depth.
     */
    depth() {

        return this.tree.depth(
            this.roots
        );

    }

    /**
     * Total layers.
     */
    count() {

        return this.nodes.length;

    }

    /**
     * Cache statistics.
     */
    stats() {

        return {

            layers: this.count(),

            smartObjects:
                this.smartObjects().length,

            groups:
                this.groups().length,

            depth:
                this.depth(),

            cache:
                this.cache.stats()

        };

    }

    /**
     * Reset engine.
     */
    clear() {

        this.nodes = [];
        this.roots = [];
        this.documentId = null;

        this.cache.clear();

    }

}

export default LayerManager;
