import { app, action } from "photoshop";

class PSDExporter {

    async export(album) {

        if (!album)
            throw new Error("Album is required.");

        if (!album.pages || album.pages.length === 0)
            throw new Error("Album has no pages.");

        for (const page of album.pages) {

            await this.exportPage(page);

        }

    }

    async exportPage(page) {

        if (!page)
            return;

        const document = app.activeDocument;

        await this.placePhotos(document, page);

        await this.savePSD(document, page);

    }

    async placePhotos(document, page) {

        for (const item of page.slots) {

            if (!item.photo)
                continue;

            await this.placePhoto(

                document,
                item.photo,
                item.slot

            );

        }

    }

    async placePhoto(document, photo, slot) {

        if (!photo || !slot)
            return;

        // TODO
        // Open image
        // Convert to Smart Object
        // Fit into slot
        // Apply clipping mask
        // Preserve aspect ratio

    }

    async savePSD(document, page) {

        const token = await this.getOutputFolder();

        await action.batchPlay(
            [
                {
                    _obj: "save",
                    as: {
                        _obj: "photoshop35Format"
                    },
                    in: token,
                    copy: true,
                    lowerCase: true
                }
            ],
            {}
        );

    }

    async getOutputFolder() {

        return app.activeDocument.path;

    }

}

export default new PSDExporter();