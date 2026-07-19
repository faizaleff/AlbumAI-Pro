// src/services/GenerationContext.js

class GenerationContext {

    constructor(job = {}) {

        this.id = crypto.randomUUID?.() ?? `job-${Date.now()}`;

        this.startedAt = new Date();

        this.job = job;

        // Input

        this.templatePath = job.templatePath ?? null;
        this.weddingFolder = job.weddingFolder ?? null;
        this.outputFolder = job.outputFolder ?? null;
        this.exportOptions = job.exportOptions ?? {};

        // Runtime

        this.template = null;
        this.document = null;

        this.photos = [];
        this.layers = [];
        this.smartObjects = [];
        this.placeholders = [];
        this.assignments = [];

        this.exports = [];

        // Statistics

        this.statistics = {

            importedPhotos: 0,
            duplicatePhotos: 0,
            placeholders: 0,
            matchedPhotos: 0,
            exportedFiles: 0

        };

        // Timings

        this.timings = {};

        // Runtime State

        this.errors = [];
        this.warnings = [];
        this.logs = [];

        this.status = "pending";

    }

    startStage(name) {

        this.timings[name] = {

            started: performance.now()

        };

    }

    finishStage(name) {

        if (!this.timings[name])
            return;

        const stage = this.timings[name];

        stage.finished = performance.now();

        stage.duration =
            stage.finished - stage.started;

    }

    warning(message) {

        this.warnings.push({

            time: new Date(),

            message

        });

    }

    error(error) {

        this.errors.push({

            time: new Date(),

            error

        });

    }

    log(message) {

        this.logs.push({

            time: new Date(),

            message

        });

    }

    finish(status = "completed") {

        this.status = status;

        this.finishedAt = new Date();

        this.duration =
            this.finishedAt - this.startedAt;

    }

}

export default GenerationContext;