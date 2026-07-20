// src/services/workflow/WorkflowContext.js

class WorkflowContext {

    constructor(job = {}) {

        //
        // Original Job
        //

        this.job = job;

        //
        // Input
        //

        this.weddingFolder =
            job.weddingFolder ?? null;

        this.templatePath =
            job.templatePath ?? null;

        this.outputFolder =
            job.outputFolder ?? null;

        this.exportOptions =
            job.exportOptions ?? {};

        //
        // Runtime
        //

        this.document = null;

        this.template = null;

        this.photos = [];

        this.layers = [];

        this.smartObjects = [];

        this.assignments = [];

        this.exports = [];

        //
        // Statistics
        //

        this.statistics = {

            imported: 0,

            matched: 0,

            replaced: 0,

            exported: 0,

            failed: 0

        };

        //
        // Timing
        //

        this.started = Date.now();

        this.finished = null;

        //
        // Messages
        //

        this.logs = [];

        this.warnings = [];

        this.errors = [];

    }

    log(message) {

        this.logs.push({

            time: Date.now(),

            message

        });

    }

    warn(message) {

        this.warnings.push({

            time: Date.now(),

            message

        });

    }

    error(message) {

        this.errors.push({

            time: Date.now(),

            message

        });

    }

    finish() {

        this.finished = Date.now();

    }

    get duration() {

        if (!this.finished)

            return Date.now() - this.started;

        return this.finished - this.started;

    }

}

export default WorkflowContext;