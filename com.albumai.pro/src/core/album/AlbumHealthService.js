import Logger from "../photoshop/Logger";
import AlbumHealthMonitor from "./AlbumHealthMonitor";

export default class AlbumHealthService {

    constructor() {

        this.monitor =
            new AlbumHealthMonitor();

    }

    start() {

        this.monitor.start();

        Logger.info(
            "Album health monitoring started."
        );

    }

    check() {

        return this.monitor.check();

    }

    status() {

        return this.monitor.status();

    }

    warning(message) {

        this.monitor.addWarning(message);

    }

    error(message) {

        this.monitor.addError(message);

    }

    clearWarnings() {

        this.monitor.clearWarnings();

    }

    clearErrors() {

        this.monitor.clearErrors();

    }

    setMemoryUsage(bytes) {

        this.monitor.setMemoryUsage(bytes);

    }

    setQueueLength(length) {

        this.monitor.setQueueLength(length);

    }

    setActiveJobs(count) {

        this.monitor.setActiveJobs(count);

    }

    update(metrics = {}) {

        if ("memoryUsage" in metrics) {

            this.setMemoryUsage(
                metrics.memoryUsage
            );

        }

        if ("queueLength" in metrics) {

            this.setQueueLength(
                metrics.queueLength
            );

        }

        if ("activeJobs" in metrics) {

            this.setActiveJobs(
                metrics.activeJobs
            );

        }

        return this.status();

    }

    isHealthy() {

        return this.status().healthy;

    }

    reset() {

        this.monitor.reset();

        Logger.info(
            "Album health monitor reset."
        );

    }

}