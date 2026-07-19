// src/core/document/DocumentLoader.js

import { app } from "photoshop";

import Photoshop from "../photoshop";
import Logger from "../photoshop/Logger";
import ErrorHandler from "../photoshop/ErrorHandler";

class DocumentLoader {

    constructor() {
        this.loadedDocuments = new Map();
        this.loading = false;
    }

    /**
     * Opens a Photoshop document from a FileSystemEntry.
     * @param {File} fileEntry
     * @returns {Promise<Document>}
     */
    async open(fileEntry) {

        if (!fileEntry)
            throw new Error("File entry is required.");

        Logger.info(`Opening document: ${fileEntry.name}`);

        return Photoshop.execute(async () => {

            try {

                this.loading = true;

                const document = await app.open(fileEntry);

                this.loadedDocuments.set(
                    document.id,
                    document
                );

                Logger.info(
                    `Document opened (${document.title})`
                );

                return document;

            } finally {

                this.loading = false;

            }

        }, {
            commandName: "Open Document"
        });

    }

    /**
     * Opens multiple documents sequentially.
     */
    async openMany(files = []) {

        const documents = [];

        for (const file of files) {

            const document =
                await this.open(file);

            documents.push(document);

        }

        return documents;

    }

    /**
     * Returns cached document.
     */
    get(documentId) {

        return this.loadedDocuments.get(documentId) || null;

    }

    /**
     * Returns all loaded documents.
     */
    getAll() {

        return [...this.loadedDocuments.values()];

    }

    /**
     * Checks cache.
     */
    has(documentId) {

        return this.loadedDocuments.has(documentId);

    }

    /**
     * Removes from cache.
     */
    remove(documentId) {

        this.loadedDocuments.delete(documentId);

    }

    /**
     * Clears cache.
     */
    clear() {

        this.loadedDocuments.clear();

    }

    /**
     * Number of cached documents.
     */
    count() {

        return this.loadedDocuments.size;

    }

    /**
     * Loading state.
     */
    isLoading() {

        return this.loading;

    }

    /**
     * Refresh cache from Photoshop.
     */
    sync() {

        this.loadedDocuments.clear();

        for (const document of app.documents) {

            this.loadedDocuments.set(
                document.id,
                document
            );

        }

        return this.count();

    }

}

export default new DocumentLoader();