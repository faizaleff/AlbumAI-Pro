class JobQueue {

    constructor(maxWorkers = 4) {

        this.maxWorkers = maxWorkers;

        this.queue = [];

        this.running = 0;

        this.cancelled = false;

    }

    add(name, task) {

        this.queue.push({
            id: Date.now() + Math.random(),
            name,
            task
        });

        this.run();

    }

    addPriority(name, task) {

        this.queue.unshift({
            id: Date.now() + Math.random(),
            name,
            task
        });

        this.run();

    }

    async run() {

        if (this.cancelled)
            return;

        while (

            this.running < this.maxWorkers &&
            this.queue.length

        ) {

            const job = this.queue.shift();

            this.running++;

            Promise.resolve(job.task())

                .catch(console.error)

                .finally(() => {

                    this.running--;

                    this.run();

                });

        }

    }

    clear() {

        this.queue = [];

    }

    cancel() {

        this.cancelled = true;

        this.queue = [];

    }

    resume() {

        this.cancelled = false;

        this.run();

    }

    size() {

        return this.queue.length;

    }

    busy() {

        return this.running;

    }

    idle() {

        return this.running === 0 &&
               this.queue.length === 0;

    }

}

export default new JobQueue(4);