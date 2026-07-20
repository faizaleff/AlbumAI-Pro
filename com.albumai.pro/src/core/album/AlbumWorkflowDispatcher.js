import Logger from "../photoshop/Logger";

export default class AlbumWorkflowDispatcher {

    constructor({

        queue,

        runner

    } = {}) {

        this.queue = queue;

        this.runner = runner;

    }

    dispatch(name, context = {}, priority = 0) {

        if (!this.queue) {

            throw new Error(

                "Workflow queue is not configured."

            );

        }

        const job =

            this.queue.create(

                name,

                context,

                priority

            );

        Logger.info(

            `Workflow dispatched: ${name}`

        );

        return job;

    }

    async dispatchAndRun(

        name,

        context = {},

        priority = 0

    ) {

        const job = this.dispatch(

            name,

            context,

            priority

        );

        if (!this.runner) {

            return job;

        }

        await this.runner.runJob(job);

        return job;

    }

    async dispatchBatch(

        jobs = []

    ) {

        const created = [];

        for (const item of jobs) {

            created.push(

                this.dispatch(

                    item.name,

                    item.context || {},

                    item.priority ?? 0

                )

            );

        }

        return created;

    }

    async run() {

        if (!this.runner) {

            throw new Error(

                "Workflow runner is not configured."

            );

        }

        return this.runner.start();

    }

    stop() {

        if (!this.runner) {

            return;

        }

        this.runner.stop();

    }

}
