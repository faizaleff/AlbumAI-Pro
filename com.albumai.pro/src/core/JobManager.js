import Logger from "./photoshop/Logger";

export default class JobManager {

    constructor() {

        this.jobs = new Map();

    }

    create(id, data = {}) {

        const job = {

            id,

            status: "pending",

            progress: 0,

            createdAt: new Date(),

            updatedAt: new Date(),

            data

        };

        this.jobs.set(id, job);

        Logger.info(`Job Created : ${id}`);

        return job;

    }

    start(id) {

        const job = this.jobs.get(id);

        if (!job)
            return null;

        job.status = "running";
        job.updatedAt = new Date();

        return job;

    }

    update(id, progress) {

        const job = this.jobs.get(id);

        if (!job)
            return null;

        job.progress = progress;
        job.updatedAt = new Date();

        return job;

    }

    complete(id) {

        const job = this.jobs.get(id);

        if (!job)
            return null;

        job.status = "completed";
        job.progress = 100;
        job.updatedAt = new Date();

        return job;

    }

    fail(id, error) {

        const job = this.jobs.get(id);

        if (!job)
            return null;

        job.status = "failed";
        job.error = error;
        job.updatedAt = new Date();

        Logger.error(error);

        return job;

    }

    cancel(id) {

        const job = this.jobs.get(id);

        if (!job)
            return null;

        job.status = "cancelled";
        job.updatedAt = new Date();

        return job;

    }

    get(id) {

        return this.jobs.get(id);

    }

    remove(id) {

        this.jobs.delete(id);

    }

    clear() {

        this.jobs.clear();

    }

    list() {

        return [...this.jobs.values()];

    }

}