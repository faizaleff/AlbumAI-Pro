import Logger from "../photoshop/Logger";

export default class AlbumWorkflowRunner {

    constructor({

        queue,

        executor,

        history = null,

        metrics = null,

        monitor = null

    } = {}) {

        this.queue = queue;

        this.executor = executor;

        this.history = history;

        this.metrics = metrics;

        this.monitor = monitor;

        this.running = false;

        this.runPromise = null;

    }

    async start() {

        if (this.running) {

            return this.runPromise;

        }

        this.running = true;

        Logger.info(

            "Workflow runner started."

        );

        this.runPromise = this.process();

        try {

            return await this.runPromise;

        }
        finally {

            this.running = false;

            this.runPromise = null;

            this.refresh();

        }

    }

    async process() {

        const jobs = [];

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

                await this.runJob(job);

            }
            catch (error) {
                Logger.error(error);

            }

            jobs.push(job);

        }

        return jobs;

    }

    stop() {

        this.running = false;

        Logger.info(

            "Workflow runner stopped."

        );

    }

    async runJob(job) {

        if (!job || typeof job.start !== "function") {

            throw new Error(

                "Invalid workflow job."

            );

        }

        if (job.isCancelled()) {

            this.metrics?.jobCancelled(job.duration());

            this.record(job);

            this.refresh();

            return null;

        }

        job.start();

        this.metrics?.jobStarted();

        this.refresh();

        try {

            const result =

                await this.executor.execute(

                    job.name,

                    job.context

                );

            job.complete(result);

            this.metrics?.jobCompleted(job.duration());

            this.record(job);

            this.refresh();

            return result;

        }
        catch (error) {

            job.fail(error);

            this.metrics?.jobFailed(job.duration());

            this.record(job);

            this.refresh();

            throw error;

        }

    }

    isRunning() {

        return this.running;

    }

    record(job) {

        this.history?.add({

            job: job.toJSON()

        });

    }

    refresh() {

        if (this.metrics && this.queue) {

            this.metrics.setPending(

                this.queue.pending().length

            );

        }

        this.monitor?.refresh();

    }

}
