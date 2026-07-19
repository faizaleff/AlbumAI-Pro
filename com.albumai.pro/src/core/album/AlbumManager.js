// src/core/album/AlbumManager.js

import AlbumQueue from "./AlbumQueue";
import AlbumProgress from "./AlbumProgress";
import AlbumValidator from "./AlbumValidator";
import AlbumExporter from "./AlbumExporter";

class AlbumManager {

    constructor({

        documentManager,
        layerManager,
        smartObjectManager,
        exporterAdapter

    }) {

        this.documentManager = documentManager;

        this.layerManager = layerManager;

        this.smartObjectManager = smartObjectManager;

        this.queue = new AlbumQueue();

        this.progress = new AlbumProgress();

        this.validator = new AlbumValidator();

        this.exporter = new AlbumExporter(
            exporterAdapter
        );

    }

    /**
     * Add album generation job.
     */
    add(job) {

        this.queue.add(job);

        return job;

    }

    /**
     * Execute all queued jobs.
     */
    async run() {

        while (true) {

            const job = this.queue.next();

            if (!job)
                break;

            await this.execute(job);

        }

    }

    /**
     * Execute one album.
     */
    async execute(job) {

        job.start();

        try {

            const validation =
                this.validator.validate(job);

            if (!validation.valid) {

                throw new Error(
                    validation.errors.join("\n")
                );

            }

            this.progress.update({

                jobId: job.id,

                stage: "Opening Template",

                current: 0,

                total: 100,

                message: "Opening PSD..."

            });

            const document =
                await this.documentManager.open(
                    job.template.file
                );

            const layers =
                this.layerManager.scan(document);

            const smartObjects =
                this.smartObjectManager.scan(
                    layers
                );

            const total =
                Math.min(
                    smartObjects.length,
                    job.photos.length
                );

            for (let i = 0; i < total; i++) {

                this.progress.update({

                    jobId: job.id,

                    stage: "Replacing Photos",

                    current: i + 1,

                    total,

                    message:
                        `Photo ${i + 1} of ${total}`

                });

                await this.smartObjectManager.replace({

                    layerId:
                        smartObjects[i].id,

                    imageFile:
                        job.photos[i],

                    mode: "fill"

                });

            }

            this.progress.update({

                jobId: job.id,

                stage: "Exporting",

                current: 95,

                total: 100,

                message:
                    "Exporting album..."

            });

            await this.exporter.export(

                job,

                document

            );

            await this.documentManager.close(
                document
            );

            job.complete();

            this.progress.complete(job.id);

            return job;

        }

        catch (error) {

            job.fail(error);

            this.progress.error(

                job.id,

                error

            );

            throw error;

        }

    }

}

export default AlbumManager;