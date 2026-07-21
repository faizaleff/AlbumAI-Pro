import { app, core } from "photoshop";
import Logger from "./Logger";

export default class DocumentManager {

    constructor() {

        this.activeDocument = null;

    }

    getActive() {

        return app.activeDocument || null;

    }

    async open(file) {

        try {

            const document = await core.executeAsModal(

                async () => {

                    return await app.open(file);

                },

                {

                    commandName: "Open Document"

                }

            );

            this.activeDocument = document;

            return document;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async activate(document) {

        if (!document) {

            throw new Error(

                "Document is required."

            );

        }

        try {

            await core.executeAsModal(

                async () => {

                    app.activeDocument = document;

                },

                {

                    commandName: "Activate Document"

                }

            );

            this.activeDocument = document;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async save(document = this.getActive()) {

        if (!document) {

            throw new Error(

                "No active document."

            );

        }

        try {

            await core.executeAsModal(

                async () => {

                    await document.save();

                },

                {

                    commandName: "Save Document"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async saveAs(document, file, options = {}) {

        if (!document) {

            throw new Error(

                "Document is required."

            );

        }

        try {

            await core.executeAsModal(

                async () => {

                    await document.saveAs.psd(

                        file,

                        options,

                        true

                    );

                },

                {

                    commandName: "Save As PSD"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async close(document = this.getActive(), save = false) {

        if (!document) {

            return;

        }

        try {

            await core.executeAsModal(

                async () => {

                    await document.closeWithoutSaving();

                    if (save) {

                        await document.save();

                    }

                },

                {

                    commandName: "Close Document"

                }

            );

            if (

                this.activeDocument === document

            ) {

                this.activeDocument = null;

            }

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    list() {

        return app.documents;

    }

    count() {

        return app.documents.length;

    }

    exists(id) {

        return app.documents.some(

            doc => doc.id === id

        );

    }

}