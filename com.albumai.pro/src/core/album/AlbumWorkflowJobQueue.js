import Logger from "../photoshop/Logger";

import AlbumWorkflowJob from "./AlbumWorkflowJob";

export default class AlbumWorkflowJobQueue {

    constructor() {

        this.jobs = [];

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

        this.jobs.push(job);

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

        return (

            this.jobs.find(

                job => job.id === id

            ) || null

        );

    }

    remove(id) {

        const index = this.jobs.findIndex(

            job => job.id === id

        );

        if (index === -1) {

            return false;

        }

        this.jobs.splice(index, 1);

        return true;

    }

    clear() {

        this.jobs = [];

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

        return [...this.jobs];

    }

    pending() {

        return this.jobs.filter(

            job => job.isPending()

        );

    }

    running() {

        return this.jobs.filter(

            job => job.isRunning()

        );

    }

    completed() {

        return this.jobs.filter(

            job => job.isCompleted()

        );

    }

    failed() {

        return this.jobs.filter(

            job => job.isFailed()

        );

    }

}