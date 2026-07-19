// src/services/ResourceManager.js

class ResourceManager {

    constructor({

        documentManager,
        smartObjectManager,
        photoCache,
        tempFileManager,
        logger

    } = {}) {

        this.documentManager = documentManager;
        this.smartObjectManager = smartObjectManager;
        this.photoCache = photoCache;
        this.tempFileManager = tempFileManager;
        this.logger = logger;

    }

    /**
     * Cleanup all runtime resources.
     */
    async cleanup(context) {

        if (!context)
            return;

        await this.closeSmartObjects(context);

        await this.closeDocument(context);

        await this.deleteTemporaryFiles(context);

        await this.clearCaches();

        this.resetContext(context);

    }

    /**
     * Close Smart Object editing sessions.
     */
    async closeSmartObjects(context) {

        if (
            !this.smartObjectManager ||
            !this.smartObjectManager.closeAll
        ) {
            return;
        }

        try {

            await this.smartObjectManager.closeAll();

        }

        catch (error) {

            this.log(error);

        }

    }

    /**
     * Close Photoshop document.
     */
    async closeDocument(context) {

        if (
            !context.document ||
            !this.documentManager ||
            !this.documentManager.close
        ) {
            return;
        }

        try {

            await this.documentManager.close(
                context.document
            );

            context.document = null;

        }

        catch (error) {

            this.log(error);

        }

    }

    /**
     * Delete temporary files.
     */
    async deleteTemporaryFiles(context) {

        if (
            !this.tempFileManager ||
            !this.tempFileManager.cleanup
        ) {
            return;
        }

        try {

            await this.tempFileManager.cleanup(
                context
            );

        }

        catch (error) {

            this.log(error);

        }

    }

    /**
     * Clear runtime caches.
     */
    async clearCaches() {

        try {

            this.photoCache?.clear();

        }

        catch (error) {

            this.log(error);

        }

    }

    /**
     * Reset context runtime references.
     */
    resetContext(context) {

        context.layers = [];
        context.smartObjects = [];
        context.assignments = [];

    }

    /**
     * Safe logging.
     */
    log(error) {

        if (this.logger?.error) {

            this.logger.error(error);

        }

    }

}

export default ResourceManager;