import Logger from "../photoshop/Logger";

export default class AlbumWorkflowMetrics {

    constructor() {

        this.reset();

    }

    reset() {

        this.data = {

            totalJobs: 0,

            completedJobs: 0,

            failedJobs: 0,

            cancelledJobs: 0,

            runningJobs: 0,

            pendingJobs: 0,

            averageExecutionTime: 0,

            totalExecutionTime: 0,

            lastExecutionTime: 0,

            successRate: 100

        };

    }

    jobStarted() {

        this.data.totalJobs++;

        this.data.runningJobs++;

        this.updateSuccessRate();

    }

    jobCompleted(duration = 0) {

        this.data.runningJobs = Math.max(

            0,

            this.data.runningJobs - 1

        );

        this.data.completedJobs++;

        this.recordExecutionTime(duration);

        this.updateSuccessRate();

    }

    jobFailed(duration = 0) {

        this.data.runningJobs = Math.max(

            0,

            this.data.runningJobs - 1

        );

        this.data.failedJobs++;

        this.recordExecutionTime(duration);

        this.updateSuccessRate();

    }

    jobCancelled(duration = 0) {

        this.data.runningJobs = Math.max(

            0,

            this.data.runningJobs - 1

        );

        this.data.cancelledJobs++;

        this.recordExecutionTime(duration);

        this.updateSuccessRate();

    }

    setPending(count) {

        this.data.pendingJobs = count;

    }

    recordExecutionTime(duration = 0) {

        this.data.lastExecutionTime = duration;

        this.data.totalExecutionTime += duration;

        const finished =

            this.data.completedJobs +

            this.data.failedJobs +

            this.data.cancelledJobs;

        this.data.averageExecutionTime =

            finished === 0

                ? 0

                : Math.round(

                    this.data.totalExecutionTime /

                    finished

                );

    }

    updateSuccessRate() {

        const finished =

            this.data.completedJobs +

            this.data.failedJobs +

            this.data.cancelledJobs;

        if (finished === 0) {

            this.data.successRate = 100;

            return;

        }

        this.data.successRate =

            Number(

                (

                    this.data.completedJobs /

                    finished

                ) * 100

            ).toFixed(2);

    }

    get(name) {

        return this.data[name];

    }

    all() {

        return {

            ...this.data

        };

    }

    log() {

        Logger.info(

            JSON.stringify(

                this.data,

                null,

                2

            )

        );

    }

}
