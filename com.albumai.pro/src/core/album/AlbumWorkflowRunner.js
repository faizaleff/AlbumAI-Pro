import Logger from "../photoshop/Logger";

export default class AlbumWorkflowRunner {

    constructor({

        queue,

        executor

    } = {}) {

        this.queue = queue;

        this.executor = executor;

        this.running = false;

    }

    async start() {

        if (this.running) {

            return;

        }

        this.running = true;

        Logger.info(

            "Workflow runner started."

        );

        while (

            this.running &&

            this.queue &&

            this.queue.hasJobs()

        ) {

            const job =

                this.queue.dequeue();

            if (!job) {

                continue;

            }

            try {

                job.start();

                const result =

                    await this.executor.execute(

                        job.name,

                        job.context

                    );

                job.complete(result);

            }
            catch (error) {

                job.fail(error);

                Logger.error(error);

            }

        }

        this.running = false;

    }

    stop() {

        this.running = false;

        Logger.info(

            "Workflow runner stopped."

        );

    }

    async runJob(job) {

        job.start();

        try {

            const result =

                await this.executor.execute(

                    job.name,

                    job.context

                );

            job.complete(result);

            return result;

        }
        catch (error) {

            job.fail(error);

            throw error;

        }

    }

    isRunning() {

        return this.running;

    }

}