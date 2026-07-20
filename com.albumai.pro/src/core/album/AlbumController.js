import Logger from "../photoshop/Logger";

import AlbumEngine from "./AlbumEngine";

export default class AlbumController {

    constructor() {

        this.engine = new AlbumEngine();

        this.initialized = false;

    }

    async initialize() {

        if (this.initialized) {

            return;

        }

        await this.engine.initialize();

        this.initialized = true;

        Logger.info(
            "Album controller initialized."
        );

    }

    async generate(project) {

        await this.initialize();

        return await this.engine.generate(project);

    }

    async generateBatch(projects = []) {

        await this.initialize();

        const results = [];

        for (const project of projects) {

            try {

                const result =

                    await this.generate(project);

                results.push({

                    projectId: project.id,

                    success: true,

                    result

                });

            }
            catch (error) {

                Logger.error(error);

                results.push({

                    projectId: project.id,

                    success: false,

                    error: error.message

                });

            }

        }

        return results;

    }

    async validate(project) {

        await this.initialize();

        return this.engine
            .kernel
            .validation()
            .validate(project);

    }

    async status() {

        await this.initialize();

        return this.engine
            .kernel
            .lifecycle()
            .status();

    }

    async shutdown() {

        this.engine.shutdown();

        this.initialized = false;

        Logger.info(
            "Album controller shutdown."
        );

    }

}