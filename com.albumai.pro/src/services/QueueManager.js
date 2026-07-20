import Logger from "../core/photoshop/Logger";

export default class QueueManager {

    constructor() {

        this.queue = [];
        this.running = false;
        this.cancelled = false;

    }

    add(item) {

        this.queue.push(item);

        Logger.debug(
            `Queue +1 (${this.queue.length})`
        );

    }

    addMany(items = []) {

        this.queue.push(...items);

        Logger.debug(
            `Queue +${items.length}`
        );

    }

    next() {

        return this.queue.shift();

    }

    peek() {

        return this.queue[0];

    }

    clear() {

        this.queue.length = 0;

    }

    cancel() {

        this.cancelled = true;

    }

    reset() {

        this.running = false;
        this.cancelled = false;
        this.clear();

    }

    isCancelled() {

        return this.cancelled;

    }

    isRunning() {

        return this.running;

    }

    size() {

        return this.queue.length;

    }

    empty() {

        return this.queue.length === 0;

    }

    async process(worker) {

        this.running = true;

        try {

            while (
                this.queue.length &&
                !this.cancelled
            ) {

                const item =
                    this.next();

                await worker(item);

            }

        }

        finally {

            this.running = false;

        }

    }

}