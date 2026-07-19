    // src/core/photoshop/HistoryManager.js

import ExecuteModal from "./ExecuteModal.js";
import Logger from "./Logger.js";
import ErrorHandler from "./ErrorHandler.js";
import PHOTOSHOP from "./Constants.js";

class HistoryManager {

    constructor() {
        this.depth = 0;
    }

    /**
     * Execute an operation as a single Photoshop history step.
     */
    async suspend(name, callback) {

        const historyName =
            name || PHOTOSHOP.HISTORY_NAME;

        return ExecuteModal.run(

            async (executionContext) => {

                this.depth++;

                Logger.info(
                    `History Begin : ${historyName}`
                );

                try {

                    // Photoshop API (UXP)
                    if (
                        executionContext &&
                        typeof executionContext.hostControl
                            ?.suspendHistory === "function"
                    ) {

                        return await executionContext.hostControl
                            .suspendHistory(
                                {
                                    name: historyName
                                },
                                async () => {

                                    return await callback(
                                        executionContext
                                    );

                                }
                            );

                    }

                    // Fallback for older hosts
                    return await callback(executionContext);

                } catch (error) {

                    throw ErrorHandler.process(error, {
                        historyName
                    });

                } finally {

                    this.depth--;

                    Logger.info(
                        `History End : ${historyName}`
                    );

                }

            },

            {
                commandName: historyName
            }

        );

    }

    /**
     * Execute without creating a grouped history state.
     */
    async execute(callback) {

        return ExecuteModal.run(callback);

    }

    /**
     * Execute multiple operations inside one history state.
     */
    async transaction(name, operations = []) {

        return this.suspend(name, async (ctx) => {

            const results = [];

            for (const operation of operations) {

                results.push(
                    await operation(ctx)
                );

            }

            return results;

        });

    }

    /**
     * Nest-safe helper.
     */
    async run(name, callback) {

        if (this.depth > 0) {

            return callback();

        }

        return this.suspend(name, callback);

    }

    get level() {
        return this.depth;
    }

    get active() {
        return this.depth > 0;
    }

}

export default new HistoryManager();