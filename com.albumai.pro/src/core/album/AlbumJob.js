// src/core/album/AlbumJob.js

class AlbumJob {

    constructor({

        id,

        template,

        photos = [],

        outputFolder,

        exportOptions = {}

    }) {

        this.id = id;

        this.template = template;

        this.photos = photos;

        this.outputFolder = outputFolder;

        this.exportOptions = exportOptions;

        this.status = "pending";

        this.progress = 0;

        this.startedAt = null;

        this.finishedAt = null;

        this.error = null;

    }

    start() {

        this.status = "running";

        this.startedAt = new Date();

    }

    complete() {

        this.status = "completed";

        this.progress = 100;

        this.finishedAt = new Date();

    }

    fail(error) {

        this.status = "failed";

        this.error = error;

        this.finishedAt = new Date();

    }

    cancel() {

        this.status = "cancelled";

        this.finishedAt = new Date();

    }

    updateProgress(value) {

        this.progress = Math.max(
            0,
            Math.min(100, value)
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

    duration() {

        if (!this.startedAt)
            return 0;

        const end = this.finishedAt ?? new Date();

        return end - this.startedAt;

    }

}

export default AlbumJob;