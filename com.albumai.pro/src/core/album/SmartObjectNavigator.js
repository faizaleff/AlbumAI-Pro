import Logger from "../photoshop/Logger";

export default class SmartObjectNavigator {

    constructor({

        documentManager

    }) {

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

        return await layer.editContents();

    }

    async save(document) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

        await document.save();

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

        if (save) {

            await document.save();

        }

        await document.close();

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