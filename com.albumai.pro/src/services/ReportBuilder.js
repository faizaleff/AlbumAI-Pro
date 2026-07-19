// src/services/ReportBuilder.js

class ReportBuilder {

    /**
     * Build success report.
     */
    success({ started, context }) {

        const finished = Date.now();

        context.finish("completed");

        return {

            success: true,

            status: "completed",

            startedAt: context.startedAt,

            finishedAt: context.finishedAt,

            duration: finished - started,

            statistics: {

                ...context.statistics

            },

            exports: [

                ...context.exports

            ],

            warnings: [

                ...context.warnings

            ],

            timings: {

                ...context.timings

            },

            logs: [

                ...context.logs

            ]

        };

    }

    /**
     * Build failure report.
     */
    failure({ started, error, context }) {

        const finished = Date.now();

        if (context) {

            context.error(error);

            context.finish("failed");

        }

        return {

            success: false,

            status: "failed",

            startedAt: context?.startedAt,

            finishedAt: context?.finishedAt,

            duration: finished - started,

            error: {

                name: error.name,

                message: error.message,

                stack: error.stack

            },

            statistics: context?.statistics ?? {},

            warnings: context?.warnings ?? [],

            errors: context?.errors ?? [],

            timings: context?.timings ?? {},

            logs: context?.logs ?? []

        };

    }

}

export default ReportBuilder;