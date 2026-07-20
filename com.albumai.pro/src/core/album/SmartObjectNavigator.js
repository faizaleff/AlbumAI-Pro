import Logger from "../photoshop/Logger";
import { app } from "photoshop";
import Photoshop from "../photoshop";

export default class SmartObjectNavigator {

    constructor({

        documentManager

    } = {}) {

        this.documentManager =
            documentManager;

    }

    async open(layer) {

        if (!layer) {

            throw new Error(
                "Smart Object layer is required."
            );

        }

        Logger.info(

            `Opening Smart Object: ${layer.name}`

        );

        const parentId = app.activeDocument?.id;

        const activeDocument = await Photoshop.execute(async () => {
            await layer.editContents();
            return app.activeDocument;
        }, { commandName: "Open Smart Object" });

        if (!activeDocument || activeDocument.id === parentId) {

            throw new Error(

                "Smart Object document did not open."

            );

        }

        return activeDocument;

    }

    async save(document) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

        await Photoshop.execute(
            () => document.save(),
            { commandName: "Save Smart Object" }
        );

        Logger.info(
            "Smart Object saved."
        );

    }

    async close(

        document,

        save = true

    ) {

        if (!document) {

            return;

        }

        await Photoshop.execute(async () => {
            if (save && !document.saved) await document.save();
            await document.close({ save: false });
        }, { commandName: "Close Smart Object" });

        Logger.info(
            "Smart Object closed."
        );

    }

    async commit(document) {

        await this.save(document);

        await this.close(

            document,

            false

        );

    }

}
