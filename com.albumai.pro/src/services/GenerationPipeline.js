import Logger from "../core/photoshop/Logger";

export default class GenerationPipeline {

    constructor({
        albumGenerator
    }) {

        this.albumGenerator =
            albumGenerator;

    }

    async run({

        template,

        photos,

        outputFolder,

        progress

    }) {

        Logger.info(
            "Generation pipeline started."
        );

        try {

            const result =
                await this.albumGenerator.generate({

                    template,

                    photos,

                    outputFolder,

                    progress

                });

            Logger.info(
                "Generation pipeline completed."
            );

            return {

                success: true,

                result

            };

        }

        catch (error) {

            Logger.error(error);

            return {

                success: false,

                error

            };

        }

    }

}