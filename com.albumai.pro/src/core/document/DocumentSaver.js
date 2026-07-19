// src/core/document/DocumentSaver.js

class DocumentSaver {

    constructor(adapter) {

        if (!adapter) {
            throw new Error("DocumentSaver requires a save adapter.");
        }

        this.adapter = adapter;

    }

    /**
     * Save the current document.
     * @param {Document} document
     */
    async save(document) {

        this.validate(document);

        await this.adapter.save(document);

        return document;

    }

    /**
     * Save document as a new file.
     * @param {Document} document
     * @param {File} file
     * @param {Object} options
     */
    async saveAs(document, file, options = {}) {

        this.validate(document);

        if (!file) {
            throw new Error("Destination file is required.");
        }

        await this.adapter.saveAs(
            document,
            file,
            options
        );

        return file;

    }

    /**
     * Check whether the document has unsaved changes.
     */
    hasUnsavedChanges(document) {

        this.validate(document);

        return !document.saved;

    }

    /**
     * Save only if required.
     */
    async saveIfNeeded(document) {

        if (this.hasUnsavedChanges(document)) {
            await this.save(document);
        }

        return document;

    }

    /**
     * Validate document object.
     */
    validate(document) {

        if (!document) {
            throw new Error("Document is required.");
        }

    }

}

export default DocumentSaver;