import Logger from "../photoshop/Logger";

export default class AlbumQueueManager {

    constructor() {

        this.queue = [];

        this.processing = false;

        this.cancelled = false;

    }

    add(project) {

        this.queue.push({

            id: crypto.randomUUID(),

            project,

            status: "pending",

            createdAt: new Date().toISOString()

        });

    }

    addMany(projects = []) {

        for (const project of projects) {

            this.add(project);

        }

    }

    remove(id) {

        this.queue = this.queue.filter(

            item => item.id !== id

        );

    }

    clear() {

        this.queue = [];

    }

    getAll() {

        return [...this.queue];

    }

    getPending() {

        return this.queue.filter(

            item => item.status === "pending"

        );

    }

    getRunning() {

        return this.queue.find(

            item => item.status === "running"

        );

    }

    getCompleted() {

        return this.queue.filter(

            item => item.status === "completed"

        );

    }

    getFailed() {

        return this.queue.filter(

            item => item.status === "failed"

        );

    }

    async process(processor, onProgress = () => {}) {

        if (this.processing) {

            throw new Error(

                "Queue is already processing."

            );

        }

        this.processing = true;

        this.cancelled = false;

        try {

            const total = this.queue.length;

            let current = 0;

            for (const item of this.queue) {

                if (this.cancelled) {

                    break;

                }

                current++;

                item.status = "running";

                try {

                    item.result = await processor(

                        item.project

                    );

                    item.status = "completed";

                }

                catch (error) {

                    Logger.error(error);

                    item.status = "failed";

                    item.error = error.message;

                }

                onProgress({

                    current,

                    total,

                    item

                });

            }

        }

        finally {

            this.processing = false;

        }

    }

    cancel() {

        this.cancelled = true;

    }

    isProcessing() {

        return this.processing;

    }

    isCancelled() {

        return this.cancelled;

    }

}