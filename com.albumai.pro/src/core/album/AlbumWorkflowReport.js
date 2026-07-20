import Logger from "../photoshop/Logger";

export default class AlbumWorkflowReport {

    constructor(metrics = null) {

        this.metrics = metrics;

    }

    setMetrics(metrics) {

        this.metrics = metrics;

        return this;

    }

    generate() {

        const data = this.metrics?.all
            ? this.metrics.all()
            : {};

        return {

            generatedAt: new Date(),

            summary: {

                totalJobs:
                    data.totalJobs || 0,

                completedJobs:
                    data.completedJobs || 0,

                failedJobs:
                    data.failedJobs || 0,

                cancelledJobs:
                    data.cancelledJobs || 0,

                pendingJobs:
                    data.pendingJobs || 0,

                runningJobs:
                    data.runningJobs || 0

            },

            performance: {

                averageExecutionTime:
                    data.averageExecutionTime || 0,

                totalExecutionTime:
                    data.totalExecutionTime || 0,

                lastExecutionTime:
                    data.lastExecutionTime || 0,

                successRate:
                    data.successRate || 0

            }

        };

    }

    print() {

        const report = this.generate();

        Logger.info(

            "Workflow Report"

        );

        Logger.info(

            JSON.stringify(

                report,

                null,

                2

            )

        );

        return report;

    }

    export() {

        return JSON.stringify(

            this.generate(),

            null,

            2

        );

    }

}