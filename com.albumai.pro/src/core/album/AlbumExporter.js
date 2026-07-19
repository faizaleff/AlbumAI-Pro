// src/core/album/AlbumExporter.js

class AlbumExporter {

    constructor(adapter) {

        this.adapter = adapter;

    }

    /**
     * Export according to AlbumJob settings.
     */
    async export(job, document) {

        const results = [];

        const formats =
            job.exportOptions.formats || [];

        for (const format of formats) {

            switch (format.toLowerCase()) {

                case "psd":

                    results.push(
                        await this.exportPSD(job, document)
                    );

                    break;

                case "jpg":

                case "jpeg":

                    results.push(
                        await this.exportJPEG(job, document)
                    );

                    break;

                case "pdf":

                    results.push(
                        await this.exportPDF(job, document)
                    );

                    break;

                default:

                    throw new Error(
                        `Unsupported export format: ${format}`
                    );

            }

        }

        return results;

    }

    /**
     * Export PSD.
     */
    async exportPSD(job, document) {

        const file =
            this.buildPath(job, "psd");

        await this.adapter.savePSD(
            document,
            file
        );

        return file;

    }

    /**
     * Export JPEG.
     */
    async exportJPEG(job, document) {

        const file =
            this.buildPath(job, "jpg");

        await this.adapter.saveJPEG(

            document,

            file,

            job.exportOptions.jpegQuality ?? 12

        );

        return file;

    }

    /**
     * Export PDF.
     */
    async exportPDF(job, document) {

        const file =
            this.buildPath(job, "pdf");

        await this.adapter.savePDF(
            document,
            file
        );

        return file;

    }

    /**
     * Output filename.
     */
    buildPath(job, extension) {

        const baseName =
            job.exportOptions.fileName ??
            job.template.name ??
            "Album";

        return {

            folder: job.outputFolder,

            name: `${baseName}.${extension}`

        };

    }

}

export default AlbumExporter;