import Logger from "../photoshop/Logger";

import AlbumKernel from "./AlbumKernel";
import AlbumGenerator from "./AlbumGenerator";

export default class AlbumEngine {

    constructor() {

        this.kernel = new AlbumKernel();

        this.generator = new AlbumGenerator();

        this.services = null;

    }

    async initialize() {

        this.services = this.kernel.boot();

        Logger.info(
            "Album engine initialized."
        );

        return this.services;

    }

    async generate(project) {

        if (!this.services) {

            await this.initialize();

        }

        const validation =

            this.services.validation.validate(project);

        if (!validation.valid) {

            throw new Error(

                validation.errors.join("\n")

            );

        }

        this.services.project.create(project);

        this.services.metadata.setAlbum(

            project.id,

            project.name

        );

        this.services.metadata.setTemplate(

            project.template?.id,

            project.template?.name

        );

        this.services.lifecycle.start({

            projectId: project.id

        });

        try {

            const result =

                await this.generator.generate(

                    project

                );

            this.services.statistics.albumGenerated();

            this.services.metadata.markGenerated();

            this.services.lifecycle.complete();

            Logger.info(

                "Album generated successfully."

            );

            return result;

        }
        catch (error) {

            this.services.lifecycle.fail(error);

            throw error;

        }

    }

    shutdown() {

        this.kernel.shutdown();

        this.services = null;

    }

}