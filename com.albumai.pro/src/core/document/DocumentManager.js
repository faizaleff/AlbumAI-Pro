// src/core/document/DocumentManager.js

import { app } from "photoshop";

import Logger from "../photoshop/Logger";

class DocumentManager {

    constructor() {
        this.activeDocumentId = null;
    }

    /**
     * Returns every open Photoshop document.
     */
    get documents() {
        return [...app.documents];
    }

    /**
     * Current active document.
     */
    get active() {
        return app.activeDocument ?? null;
    }

    /**
     * Active document ID.
     */
    get activeId() {
        return this.active?.id ?? null;
    }

    /**
     * Total open documents.
     */
    get count() {
        return app.documents.length;
    }

    /**
     * Synchronize internal state.
     */
    sync() {

        this.activeDocumentId = this.activeId;

        return this.active;
    }

    /**
     * Find document by ID.
     */
    byId(id) {

        return this.documents.find(
            doc => doc.id === id
        ) || null;

    }

    /**
     * Find document by title.
     */
    byTitle(title) {

        return this.documents.find(
            doc => doc.title === title
        ) || null;

    }

    /**
     * Remember active document.
     */
    remember() {

        this.activeDocumentId = this.activeId;

        Logger.debug(
            `Remembered document ${this.activeDocumentId}`
        );

    }

    /**
     * Returns remembered document.
     */
    remembered() {

        if (!this.activeDocumentId)
            return null;

        return this.byId(
            this.activeDocumentId
        );

    }

    /**
     * Checks whether any document is open.
     */
    hasDocuments() {

        return this.count > 0;

    }

    /**
     * Returns true if a document exists.
     */
    exists(id) {

        return this.byId(id) !== null;

    }

    /**
     * Returns document names.
     */
    names() {

        return this.documents.map(
            doc => doc.title
        );

    }

    /**
     * Clears cached state.
     */
    reset() {

        this.activeDocumentId = null;

    }

}

export default new DocumentManager();