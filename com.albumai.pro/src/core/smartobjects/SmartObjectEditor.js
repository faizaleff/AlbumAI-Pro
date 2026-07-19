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

        this.parentDocument = app.activeDocument;

        await core.executeAsModal(async () => {

            await layer.editContents();

        }, {
            commandName: "Open Smart Object"
        });

        this.smartObjectDocument = app.activeDocument;

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

        await core.executeAsModal(async () => {

            await this.smartObjectDocument.close({
                save
            });

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

        await this.close(true);

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