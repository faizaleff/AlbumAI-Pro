// src/core/document/DocumentCloser.js

class DocumentCloser {

    constructor(adapter) {

        if (!adapter) {
            throw new Error("DocumentCloser requires a close adapter.");
        }

        this.adapter = adapter;

    }

    /**
     * Close a document.
     * @param {Document} document
     * @param {Object} options
     */
    async close(document, options = {}) {

        this.validate(document);

        const {

            save = false,

            force = false

        } = options;

        if (!force && !document.saved && !save) {

            throw new Error(
                "Document has unsaved changes."
            );

        }

        if (save && !document.saved) {

            await this.adapter.save(document);

        }

        await this.adapter.close(

            document,

            {
                save
            }

        );

    }

    /**
     * Close multiple documents.
     * @param {Document[]} documents
     * @param {Object} options
     */
    async closeAll(documents, options = {}) {

        if (!Array.isArray(documents))
            return;

        for (const document of documents) {

            await this.close(
                document,
                options
            );

        }

    }

    /**
     * Force close without saving.
     */
    async forceClose(document) {

        return this.close(

            document,

            {
                force: true,
                save: false
            }

        );

    }

    /**
     * Save and close.
     */
    async saveAndClose(document) {

        return this.close(

            document,

            {
                save: true
            }

        );

    }

    validate(document) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

    }

}

export default DocumentCloser;