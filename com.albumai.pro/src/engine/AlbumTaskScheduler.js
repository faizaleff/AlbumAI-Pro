class AlbumTaskScheduler {

    constructor(concurrency = 4) {

        this.concurrency = concurrency;

        this.queue = [];

        this.running = 0;

        this.paused = false;

    }

    add(task) {

        return new Promise((resolve, reject) => {

            this.queue.push({

                task,

                resolve,

                reject

            });

            this.process();

        });

    }

    addPriority(task) {

        return new Promise((resolve, reject) => {

            this.queue.unshift({

                task,

                resolve,

                reject

            });

            this.process();

        });

    }

    async process() {

        if (this.paused)
            return;

        while (

            this.running < this.concurrency &&

            this.queue.length

        ) {

            const item = this.queue.shift();

            this.running++;

            (async () => {

                try {

                    const result =
                        await item.task();

                    item.resolve(result);

                }

                catch (error) {

                    item.reject(error);

                }

                finally {

                    this.running--;

                    this.process();

                }

            })();

        }

    }

    pause() {

        this.paused = true;

    }

    resume() {

        this.paused = false;

        this.process();

    }

    clear() {

        this.queue = [];

    }

    isPaused() {

        return this.paused;

    }

    pending() {

        return this.queue.length;

    }

    active() {

        return this.running;

    }

    idle() {

        return this.running === 0 &&
               this.queue.length === 0;

    }

}

export default new AlbumTaskScheduler();