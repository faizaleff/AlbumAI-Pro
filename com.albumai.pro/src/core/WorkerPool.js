import Logger from "./photoshop/Logger";

export default class WorkerPool {

    constructor(maxWorkers = 4) {

        this.maxWorkers = maxWorkers;

        this.running = 0;

        this.queue = [];

    }

    async add(task) {

        return new Promise((resolve, reject) => {

            this.queue.push({

                task,

                resolve,

                reject

            });

            this.process();

        });

    }

    async process() {

        if (this.running >= this.maxWorkers)
            return;

        const item = this.queue.shift();

        if (!item)
            return;

        this.running++;

        try {

            Logger.debug(
                `Worker Started (${this.running}/${this.maxWorkers})`
            );

            const result =
                await item.task();

            item.resolve(result);

        }

        catch (error) {

            Logger.error(error);

            item.reject(error);

        }

        finally {

            this.running--;

            this.process();

        }

    }

    async wait() {

        while (

            this.running ||

            this.queue.length

        ) {

            await new Promise(

                resolve =>

                    setTimeout(resolve, 20)

            );

        }

    }

    clear() {

        this.queue = [];

    }

    pending() {

        return this.queue.length;

    }

    active() {

        return this.running;

    }

}