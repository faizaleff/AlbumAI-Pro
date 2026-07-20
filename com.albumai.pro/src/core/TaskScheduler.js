import Logger from "./photoshop/Logger";

export default class TaskScheduler {

    constructor() {

        this.queue = [];

        this.running = false;

    }

    add(task) {

        if (typeof task !== "function") {

            throw new Error(
                "Task must be a function."
            );

        }

        this.queue.push(task);

        return this;

    }

    async run() {

        if (this.running)
            return;

        this.running = true;

        Logger.info(
            "Task Scheduler Started."
        );

        try {

            while (this.queue.length) {

                const task =
                    this.queue.shift();

                await task();

            }

        }

        finally {

            this.running = false;

            Logger.info(
                "Task Scheduler Finished."
            );

        }

    }

    clear() {

        this.queue.length = 0;

    }

    size() {

        return this.queue.length;

    }

    isRunning() {

        return this.running;

    }

}