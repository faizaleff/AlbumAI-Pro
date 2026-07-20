import Logger from "../photoshop/Logger";

import AlbumPipeline from "./AlbumPipeline";

export default class AlbumPipelineFactory {

    static create() {

        Logger.info(
            "Creating empty album pipeline."
        );

        return new AlbumPipeline();

    }

    static fromSteps(steps = []) {

        const pipeline =
            new AlbumPipeline();

        for (const step of steps) {

            if (

                !step ||

                typeof step.handler !== "function"

            ) {

                continue;

            }

            pipeline.use(

                step.name ||

                "Unnamed Step",

                step.handler

            );

        }

        return pipeline;

    }

    static clone(source) {

        const pipeline =
            new AlbumPipeline();

        if (

            !source ||

            typeof source.names !== "function"

        ) {

            return pipeline;

        }

        for (const stepName of source.names()) {

            const step =
                source.get(stepName);

            if (step) {

                pipeline.use(

                    step.name,

                    step.handler

                );

            }

        }

        Logger.info(
            "Album pipeline cloned."
        );

        return pipeline;

    }

    static merge(...pipelines) {

        const merged =
            new AlbumPipeline();

        for (const pipeline of pipelines) {

            if (

                !pipeline ||

                typeof pipeline.names !== "function"

            ) {

                continue;

            }

            for (const name of pipeline.names()) {

                const step =
                    pipeline.get(name);

                if (step) {

                    merged.use(

                        step.name,

                        step.handler

                    );

                }

            }

        }

        Logger.info(
            "Album pipelines merged."
        );

        return merged;

    }

}