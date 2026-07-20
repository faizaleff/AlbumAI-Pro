import Logger from "../core/photoshop/Logger";

export default class GenerationController {

    constructor({
        pipeline,
        progressService,
        queueManager
    }) {

        this.pipeline = pipeline;
        this.progressService = progressService;
        this.queueManager = queueManager;

    }

    async generate(options) {

        try {

            this.progressService.start();

            const result =
                await this.pipeline.run({

                    ...options,

                    progress: (progress) => {

                        this.progressService.update(

                            progress.stage,

                            progress.value,

                            progress

                        );

                    }

                });

            this.progressService.finish();

            return result;

        }

        catch (error) {

            Logger.error(error);

            this.progressService.error(error);

            throw error;

        }

    }

    async generateQueue(tasks = []) {

        this.queueManager.reset();

        this.queueManager.addMany(tasks);

        return this.queueManager.process(

            async (task) => {

                await this.generate(task);

            }

        );

    }

    cancel() {

        this.queueManager.cancel();

    }

}