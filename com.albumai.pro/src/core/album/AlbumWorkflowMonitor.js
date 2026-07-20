import Logger from "../photoshop/Logger";

export default class AlbumWorkflowMonitor {

    constructor(queue = null) {

        this.queue = queue;

        this.running = false;

        this.startedAt = null;

        this.lastActivity = null;

        this.metrics = {

            queued: 0,

            running: 0,

            completed: 0,

            failed: 0,

            cancelled: 0

        };

    }

    attach(queue) {

        this.queue = queue;

        return this;

    }

    start() {

        this.running = true;

        this.startedAt = new Date();

        this.lastActivity = new Date();

        Logger.info(

            "Workflow monitor started."

        );

    }

    stop() {

        this.running = false;

        this.lastActivity = new Date();

        Logger.info(

            "Workflow monitor stopped."

        );

    }

    refresh() {

        this.lastActivity = new Date();

        if (!this.queue) {

            return this.metrics;

        }

        this.metrics.queued =

            this.queue.size();

        if (

            typeof this.queue.running === "function"

        ) {

            this.metrics.running =

                this.queue.running().length;

        }

        if (

            typeof this.queue.completed === "function"

        ) {

            this.metrics.completed =

                this.queue.completed().length;

        }

        if (

            typeof this.queue.failed === "function"

        ) {

            this.metrics.failed =

                this.queue.failed().length;

        }

        if (

            typeof this.queue.list === "function"

        ) {

            this.metrics.cancelled =

                this.queue.list().filter(

                    job => job.isCancelled()

                ).length;

        }

        return this.metrics;

    }

    status() {

        return {

            running: this.running,

            startedAt: this.startedAt,

            lastActivity: this.lastActivity,

            metrics: {

                ...this.refresh()

            }

        };

    }

    reset() {

        this.running = false;

        this.startedAt = null;

        this.lastActivity = null;

        this.metrics = {

            queued: 0,

            running: 0,

            completed: 0,

            failed: 0,

            cancelled: 0

        };

    }

}