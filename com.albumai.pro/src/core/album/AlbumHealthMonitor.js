import Logger from "../photoshop/Logger";

export default class AlbumHealthMonitor {

    constructor() {

        this.reset();

    }

    reset() {

        this.health = {

            healthy: true,

            startedAt: null,

            lastCheck: null,

            warnings: [],

            errors: [],

            memoryUsage: null,

            queueLength: 0,

            activeJobs: 0

        };

    }

    start() {

        this.health.startedAt = new Date();

        this.health.lastCheck = new Date();

    }

    check() {

        this.health.lastCheck = new Date();

        this.health.healthy =

            this.health.errors.length === 0;

        return this.health.healthy;

    }

    addWarning(message) {

        this.health.warnings.push({

            message,

            time: new Date()

        });

        Logger.warn(message);

    }

    addError(message) {

        this.health.errors.push({

            message,

            time: new Date()

        });

        this.health.healthy = false;

        Logger.error(message);

    }

    clearWarnings() {

        this.health.warnings = [];

    }

    clearErrors() {

        this.health.errors = [];

        this.health.healthy = true;

    }

    setMemoryUsage(value) {

        this.health.memoryUsage = value;
    }

    setQueueLength(length) {

        this.health.queueLength = length;
    }

    setActiveJobs(count) {

        this.health.activeJobs = count;
    }

    status() {

        this.check();

        return {

            ...this.health

        };

    }

}