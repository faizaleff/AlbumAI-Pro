import Logger from "../photoshop/Logger";

export default class AlbumWorkflowScheduler {

    constructor(executor) {

        this.executor = executor;

        this.queue = [];

        this.running = false;

    }

    schedule(name, context = {}) {

        this.queue.push({

            name,

            context

        });

        Logger.info(

            `Workflow scheduled: ${name}`

        );

        return this;

    }

    async run() {

        if (this.running) {

            return;

        }

        this.running = true;

        while (this.queue.length) {

            const job = this.queue.shift();

            try {

                await this.executor.execute(

                    job.name,

                    job.context

                );

            }
            catch (error) {

                Logger.error(error);

            }

        }

        this.running = false;

    }

    async runNext() {

        if (!this.queue.length) {

            return null;

        }

        const job = this.queue.shift();

        return this.executor.execute(

            job.name,

            job.context

        );

    }

    clear() {

        this.queue = [];

    }

    size() {

        return this.queue.length;

    }

    isRunning() {

        return this.running;

    }

    hasJobs() {

        return this.queue.length > 0;

    }

    peek() {

        return this.queue[0] || null;

    }

    jobs() {

        return [...this.queue];

    }

}