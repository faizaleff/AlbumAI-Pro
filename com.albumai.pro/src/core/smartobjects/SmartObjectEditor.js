// src/core/smartobjects/SmartObjectEditor.js

import { app, core } from "photoshop";

class SmartObjectEditor {

    constructor() {

        this.parentDocument = null;
        this.smartObjectDocument = null;

    }

    /**
     * Open a Smart Object for editing.
     * The supplied layer must be the live Photoshop layer.
     */
    async open(layer) {

        if (!layer)
            throw new Error("Layer is required.");

        const parentDocument = app.activeDocument;
        if (!parentDocument) throw new Error("Open the parent PSD before editing a Smart Object.");

        await core.executeAsModal(async () => {

            await layer.editContents();

        }, {
            commandName: "Open Smart Object"
        });

        const smartObjectDocument = app.activeDocument;

        if (!smartObjectDocument || smartObjectDocument.id === parentDocument.id) {
            throw new Error("Photoshop did not switch to the Smart Object document.");
        }

        this.parentDocument = parentDocument;
        this.smartObjectDocument = smartObjectDocument;

        return this.smartObjectDocument;

    }

    /**
     * Current Smart Object document.
     */
    current() {

        return this.smartObjectDocument;

    }

    /**
     * Parent document.
     */
    parent() {

        return this.parentDocument;

    }

    /**
     * Is Smart Object currently open?
     */
    isOpen() {

        return !!this.smartObjectDocument;

    }

    /**
     * Save Smart Object.
     */
    async save() {

        if (!this.smartObjectDocument)
            return;

        await core.executeAsModal(async () => {

            await this.smartObjectDocument.save();

        }, {
            commandName: "Save Smart Object"
        });

    }

    /**
     * Close Smart Object.
     */
    async close(save = true) {

        if (!this.smartObjectDocument)
            return;

        const document = this.smartObjectDocument;

        await core.executeAsModal(async () => {
            await document.close({ save });

        }, {
            commandName: "Close Smart Object"
        });

        this.smartObjectDocument = null;

    }

    /**
     * Return to parent PSD.
     */
    async returnToParent() {

        if (!this.parentDocument)
            return;

        await core.executeAsModal(async () => {

            app.activeDocument = this.parentDocument;

        }, {
            commandName: "Return To Parent"
        });

    }

    /**
     * Save, close and return.
     */
    async commit() {

        await this.save();

        await this.close(false);

        await this.returnToParent();

    }

    /**
     * Discard edits.
     */
    async rollback() {

        await this.close(false);

        await this.returnToParent();

    }

}

export default SmartObjectEditor;
