import { app, core } from "photoshop";

import DocumentManager from "./DocumentManager";
import SmartObjectManager from "./SmartObjectManager";
import BatchPlayService from "./BatchPlayService";
import Logger from "./Logger";

export default class PhotoshopAdapter {

    constructor({

        documentManager = new DocumentManager(),

        smartObjectManager = new SmartObjectManager(),

        batchPlayService = new BatchPlayService()

    } = {}) {

        this.documents = documentManager;

        this.smartObjects = smartObjectManager;

        this.batchPlay = batchPlayService;

    }

    async execute(commandName, callback) {

        try {

            return await core.executeAsModal(

                callback,

                {

                    commandName

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async openDocument(file) {

        return this.documents.open(file);

    }

    async activateDocument(document) {

        return this.documents.activate(document);

    }

    async saveDocument(document) {

        return this.documents.save(document);

    }

    async saveDocumentAs(document, file, options = {}) {

        return this.documents.saveAs(

            document,

            file,

            options

        );

    }

    async closeDocument(document, save = false) {

        return this.documents.close(

            document,

            save

        );

    }

    getActiveDocument() {

        return this.documents.getActive();

    }

    getDocuments() {

        return this.documents.list();

    }

    async openSmartObject(layerId) {

        return this.smartObjects.open(layerId);

    }

    async replaceSmartObject({

        layerId,

        fileToken

    }) {

        return this.smartObjects.replace({

            layerId,

            fileToken

        });

    }

    async saveSmartObject() {

        return this.smartObjects.save();

    }

    async closeSmartObject() {

        return this.smartObjects.close();

    }

    async batch(commands, options = {}) {

        return this.batchPlay.execute(

            commands,

            options

        );

    }

    async batchOne(command, options = {}) {

        return this.batchPlay.executeSingle(

            command,

            options

        );

    }

    async get(target) {

        return this.batchPlay.get(target);

    }

    async set(target, value) {

        return this.batchPlay.set(

            target,

            value

        );

    }

    async delete(target) {

        return this.batchPlay.delete(target);

    }

    async select(target) {

        return this.batchPlay.select(target);

    }

    getApplication() {

        return app;

    }

}