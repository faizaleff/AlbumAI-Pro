import PSDExporter from "../album/PSDExporter";

class AlbumExportEngine {

    async export(album, options = {}) {

        if (!album)
            throw new Error("Album is required.");

        const {

            format = "PSD",

            output = null

        } = options;

        switch (format.toUpperCase()) {

            case "PSD":
                return this.exportPSD(album, output);

            case "JSON":
                return this.exportJSON(album);

            default:
                throw new Error(`Unsupported format: ${format}`);

        }

    }

    async exportPSD(album, output = null) {

        if (output)
            album.output = output;

        await PSDExporter.export(album);

        return {

            success: true,

            format: "PSD",

            pages: album.pages.length

        };

    }

    async exportJSON(album) {

        return JSON.stringify(

            {

                name: album.name,

                created: album.created,

                totalPages: album.totalPages,

                totalPhotos: album.totalPhotos,

                template: album.template,

                pages: album.pages

            },

            null,

            2

        );

    }

    async exportPage(page) {

        return PSDExporter.exportPage(page);

    }

    async exportPages(pages = []) {

        const results = [];

        for (const page of pages) {

            await this.exportPage(page);

            results.push(page.id);

        }

        return results;

    }

    async exportPreview(album) {

        return {

            name: album.name,

            pages: album.pages.map(page => ({

                id: page.id,

                slots: page.slots.length,

                filled: page.slots.filter(

                    slot => slot.photo

                ).length

            }))

        };

    }

}

export default new AlbumExportEngine();