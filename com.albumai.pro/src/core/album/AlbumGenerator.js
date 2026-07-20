import Logger from "../photoshop/Logger";

export default class AlbumGenerator {

    constructor({

        photoImportService,

        templateService,

        documentManager,

        generationPipeline,

        albumExporter,

        progressService,

        statisticsService

    }) {

        this.photoImportService =
            photoImportService;

        this.templateService =
            templateService;

        this.documentManager =
            documentManager;

        this.generationPipeline =
            generationPipeline;

        this.albumExporter =
            albumExporter;

        this.progressService =
            progressService;

        this.statisticsService =
            statisticsService;

    }

    async generate({

        template,

        photos,

        outputFolder,

        options = {}

    }) {

        Logger.info(
            "Album generation started."
        );

        this.statisticsService.start();

        this.progressService.start(
            photos.length
        );

        try {

            const document =
                await this.templateService.load(
                    template
                );

            const importedPhotos =
                await this.photoImportService.import(
                    photos
                );

            const result =
                await this.generationPipeline.run({

                    document,

                    photos: importedPhotos,

                    options,

                    progress: progress => {

                        this.progressService.update(
                            progress
                        );

                    }

                });

            await this.albumExporter.export({

                document,

                outputFolder,

                options

            });

            this.statisticsService.finish();

            Logger.info(
                "Album generation completed."
            );

            return result;

        }

        catch (error) {

            this.statisticsService.fail();

            Logger.error(error);

            throw error;

        }

        finally {

            this.progressService.finish();

        }

    }

}