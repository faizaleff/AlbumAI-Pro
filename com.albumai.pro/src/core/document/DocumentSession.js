// src/core/document/DocumentSession.js

class DocumentSession {

    constructor() {

        this.documents = new Map();
        this.activeDocumentId = null;
        this.documentStack = [];

    }

    /**
     * Register an opened document.
     */
    register(document) {

        this.validate(document);

        this.documents.set(document.id, document);

        this.activeDocumentId = document.id;

        return document;

    }

    /**
     * Remove a closed document.
     */
    unregister(document) {

        this.validate(document);

        this.documents.delete(document.id);

        if (this.activeDocumentId === document.id) {

            this.activeDocumentId = null;

        }

    }

    /**
     * Get document by ID.
     */
    get(id) {

        return this.documents.get(id) ?? null;

    }

    /**
     * Get all opened documents.
     */
    getAll() {

        return [...this.documents.values()];

    }

    /**
     * Returns active document.
     */
    getActive() {

        if (!this.activeDocumentId)
            return null;

        return this.documents.get(
            this.activeDocumentId
        ) ?? null;

    }

    /**
     * Set active document.
     */
    setActive(document) {

        this.validate(document);

        if (!this.documents.has(document.id)) {

            throw new Error(
                "Document is not registered."
            );

        }

        this.activeDocumentId = document.id;

    }

    /**
     * Push current active document.
     */
    push(document) {

        this.validate(document);

        this.documentStack.push(document.id);

        this.setActive(document);

    }

    /**
     * Restore previous document.
     */
    pop() {

        if (this.documentStack.length === 0)
            return null;

        const previousId =
            this.documentStack.pop();

        this.activeDocumentId = previousId;

        return this.get(previousId);

    }

    /**
     * Check registration.
     */
    has(document) {

        return this.documents.has(document.id);

    }

    /**
     * Number of opened documents.
     */
    count() {

        return this.documents.size;

    }

    /**
     * Clear session.
     */
    clear() {

        this.documents.clear();

        this.documentStack = [];

        this.activeDocumentId = null;

    }

    validate(document) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

        if (document.id == null) {

            throw new Error(
                "Document ID is required."
            );

        }

    }

}

export default DocumentSession;