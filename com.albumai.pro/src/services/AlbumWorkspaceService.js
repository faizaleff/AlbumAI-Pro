import Logger from "../core/photoshop/Logger";

export default class AlbumWorkspaceService {

    constructor({

        applicationContext,

        documentManager,

        resourceManager,

        cacheManager,

        eventBus

    }) {

        this.applicationContext =
            applicationContext;

        this.documentManager =
            documentManager;

        this.resourceManager =
            resourceManager;

        this.cacheManager =
            cacheManager;

        this.eventBus =
            eventBus;

    }

    async initialize(document) {

        if (!document)
            throw new Error(
                "Document required."
            );

        this.applicationContext.set(
            "document",
            document
        );

        this.applicationContext.set(
            "workspaceStarted",
            new Date()
        );

        this.cacheManager.clear();

        Logger.info(
            "Workspace Initialized."
        );

        this.eventBus.emit(
            "workspace:initialized",
            {
                document
            }
        );

        return document;

    }

    async activate(document) {

        await this.documentManager.activate(
            document
        );

        this.applicationContext.set(
            "document",
            document
        );

        this.eventBus.emit(
            "workspace:activated",
            {
                document
            }
        );

    }

    getDocument() {

        return this.applicationContext.get(
            "document"
        );

    }

    async dispose() {

        this.resourceManager.clear();

        this.cacheManager.clear();

        this.applicationContext.clear();

        this.eventBus.emit(
            "workspace:disposed"
        );

        Logger.info(
            "Workspace Disposed."
        );

    }

}