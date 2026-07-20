export default class AlbumWorkflowJob {

    constructor({

        id = crypto.randomUUID(),

        name,

        context = {},

        priority = 0

    } = {}) {

        this.id = id;

        this.name = name;

        this.context = context;

        this.priority = priority;

        this.status = "pending";

        this.createdAt = new Date();

        this.startedAt = null;

        this.completedAt = null;

        this.error = null;

        this.result = null;

    }

    start() {

        this.status = "running";

        this.startedAt = new Date();

        return this;

    }

    complete(result = null) {

        this.status = "completed";

        this.completedAt = new Date();

        this.result = result;

        return this;

    }

    fail(error) {

        this.status = "failed";

        this.completedAt = new Date();

        this.error = error?.message || String(error);

        return this;

    }

    cancel() {

        this.status = "cancelled";

        this.completedAt = new Date();

        return this;

    }

    reset() {

        this.status = "pending";

        this.startedAt = null;

        this.completedAt = null;

        this.error = null;

        this.result = null;

        return this;

    }

    duration() {

        if (

            !this.startedAt ||

            !this.completedAt

        ) {

            return 0;

        }

        return (

            this.completedAt -

            this.startedAt

        );

    }

    isPending() {

        return this.status === "pending";

    }

    isRunning() {

        return this.status === "running";

    }

    isCompleted() {

        return this.status === "completed";

    }

    isFailed() {

        return this.status === "failed";

    }

    isCancelled() {

        return this.status === "cancelled";

    }

    toJSON() {

        return {

            id: this.id,

            name: this.name,

            status: this.status,

            priority: this.priority,

            createdAt: this.createdAt,

            startedAt: this.startedAt,

            completedAt: this.completedAt,

            duration: this.duration(),

            error: this.error,

            result: this.result

        };

    }

}