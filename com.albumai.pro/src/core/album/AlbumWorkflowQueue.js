import Logger from "../photoshop/Logger";

export default class AlbumWorkflowQueue {

    constructor() {

        this.queue = [];

    }

    enqueue(name, context = {}) {

        const job = {

            id: crypto.randomUUID(),

            name,

            context,

            createdAt: new Date()

        };

        this.queue.push(job);

        Logger.info(

            `Workflow queued: ${name}`

        );

        return job;

    }

    dequeue() {

        return this.queue.shift() || null;

    }

    peek() {

        return this.queue[0] || null;

    }

    clear() {

        this.queue = [];

        Logger.info(

            "Workflow queue cleared."

        );

    }

    size() {

        return this.queue.length;

    }

    isEmpty() {

        return this.queue.length === 0;

    }

    hasJobs() {

        return !this.isEmpty();

    }

    jobs() {

        return [...this.queue];

    }

    remove(id) {

        const index = this.queue.findIndex(

            job => job.id === id

        );

        if (index === -1) {

            return false;

        }

        this.queue.splice(index, 1);

        return true;

    }

    find(id) {

        return this.queue.find(

            job => job.id === id

        ) || null;

    }

    forEach(callback) {

        this.queue.forEach(callback);

    }

}