import Logger from "../photoshop/Logger";

import AlbumWorkflowJob from "./AlbumWorkflowJob";

export default class AlbumWorkflowJobQueue {

    constructor() {

        this.jobs = [];

        this.index = new Map();

    }

    create(name, context = {}, priority = 0) {

        const job = new AlbumWorkflowJob({

            name,

            context,

            priority

        });

        this.enqueue(job);

        return job;

    }

    enqueue(job) {

        if (!(job instanceof AlbumWorkflowJob)) {

            throw new Error(

                "Invalid workflow job."

            );

        }

        if (this.index.has(job.id)) {

            throw new Error(

                `Workflow job already queued: ${job.id}`

            );

        }

        this.jobs.push(job);

        this.index.set(job.id, job);

        this.jobs.sort(

            (a, b) =>

                b.priority -

                a.priority

        );

        Logger.info(

            `Workflow job queued: ${job.name}`

        );

        return job;

    }

    dequeue() {

        return this.jobs.shift() || null;

    }

    peek() {

        return this.jobs[0] || null;

    }

    get(id) {

        return this.index.get(id) || null;

    }

    remove(id) {

        const index = this.jobs.findIndex(

            job => job.id === id

        );

        if (index === -1) {
            return this.index.delete(id);

        }

        this.jobs.splice(index, 1);

        this.index.delete(id);

        return true;

    }

    cancel(id) {

        const job = this.get(id);

        if (!job || !job.isPending()) {

            return null;

        }

        job.cancel();

        return job;

    }

    clear() {

        this.jobs = [];

        this.index.clear();

        Logger.info(

            "Workflow job queue cleared."

        );

    }

    size() {

        return this.jobs.length;

    }

    isEmpty() {

        return this.jobs.length === 0;

    }

    hasJobs() {

        return !this.isEmpty();

    }

    list() {

        return [...this.index.values()];

    }

    pending() {

        return this.list().filter(

            job => job.isPending()

        );

    }

    running() {

        return this.list().filter(

            job => job.isRunning()

        );

    }

    completed() {

        return this.list().filter(

            job => job.isCompleted()

        );

    }

    failed() {

        return this.list().filter(

            job => job.isFailed()

        );

    }

    cancelled() {

        return this.list().filter(

            job => job.isCancelled()

        );

    }

}
