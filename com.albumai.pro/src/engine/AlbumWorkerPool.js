class AlbumWorkerPool {

    constructor(maxWorkers = 4) {

        this.maxWorkers = maxWorkers;

        this.workers = [];

        this.queue = [];

        this.running = false;

    }

    async start() {

        if (this.running)
            return;

        this.running = true;

        for (let i = 0; i < this.maxWorkers; i++) {

            this.workers.push(

                this.run(i)

            );

        }

    }

    async stop() {

        this.running = false;

        await Promise.all(this.workers);

        this.workers = [];

    }

    add(task) {

        return new Promise((resolve, reject) => {

            this.queue.push({

                task,

                resolve,

                reject

            });

        });

    }

    addPriority(task) {

        return new Promise((resolve, reject) => {

            this.queue.unshift({

                task,

                resolve,

                reject

            });

        });

    }

    async run(workerId) {

        while (this.running) {

            const item = this.queue.shift();

            if (!item) {

                await this.sleep(10);

                continue;

            }

            try {

                const result =

                    await item.task(workerId);

                item.resolve(result);

            }

            catch (error) {

                item.reject(error);

            }

        }

    }

    sleep(ms) {

        return new Promise(

            resolve => setTimeout(resolve, ms)

        );

    }

    clear() {

        this.queue = [];

    }

    pending() {

        return this.queue.length;

    }

    activeWorkers() {

        return this.workers.length;

    }

    isRunning() {

        return this.running;

    }

    statistics() {

        return {

            running: this.running,

            workers: this.workers.length,

            maxWorkers: this.maxWorkers,

            pending: this.pending()

        };

    }

}

export default new AlbumWorkerPool();