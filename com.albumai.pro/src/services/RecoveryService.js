import Logger from "../core/photoshop/Logger";

export default class RecoveryService {

    constructor({
        documentManager
    }) {

        this.documentManager =
            documentManager;

        this.snapshots = new Map();

    }

    remember(key, document) {

        if (!key || !document)
            return;

        this.snapshots.set(key, document);

        Logger.debug(
            `Recovery saved: ${key}`
        );

    }

    async restore(key) {

        if (!this.snapshots.has(key))
            return null;

        const document =
            this.snapshots.get(key);

        try {

            await this.documentManager.activate(
                document
            );

            Logger.info(
                `Recovery restored: ${key}`
            );

            return document;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async close(key, save = false) {

        const document =
            this.snapshots.get(key);

        if (!document)
            return;

        try {

            await this.documentManager.close(
                document,
                save
            );

        }

        finally {

            this.snapshots.delete(key);

        }

    }

    clear() {

        this.snapshots.clear();

    }

    remove(key) {

        this.snapshots.delete(key);

    }

    has(key) {

        return this.snapshots.has(key);

    }

    keys() {

        return [...this.snapshots.keys()];

    }

    size() {

        return this.snapshots.size;

    }

}