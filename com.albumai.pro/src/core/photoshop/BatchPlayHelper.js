// src/core/photoshop/BatchPlayHelper.js

import { action } from "photoshop";

import Logger from "./Logger.js";
import ErrorHandler from "./ErrorHandler.js";
import PHOTOSHOP from "./Constants.js";
import ExecuteModal from "./ExecuteModal.js";

class BatchPlayHelper {

    constructor() {
        this.defaultOptions = {
            synchronousExecution: true,
            modalBehavior: "fail"
        };
    }

    /**
     * Execute one or more BatchPlay descriptors.
     */
    async execute(descriptors, options = {}) {

        const commands = Array.isArray(descriptors)
            ? descriptors
            : [descriptors];

        this.validate(commands);

        const settings = {
            ...this.defaultOptions,
            ...options
        };

        Logger.info(
            `BatchPlay (${commands.length} command${commands.length > 1 ? "s" : ""})`
        );

        Logger.time("BatchPlay");

        try {

            // Retrying mutating descriptors can duplicate a placement or
            // transform after Photoshop has already applied it.
            const result = await ExecuteModal.run(
                () => action.batchPlay(commands, settings),
                { commandName: options.commandName || PHOTOSHOP.HISTORY_NAME }
            );

            const failed = result.find(item => item?._obj === "error");
            if (failed) {
                throw new Error(failed.message || failed._message || "Photoshop rejected a BatchPlay command.");
            }

            Logger.timeEnd("BatchPlay");

            return result;

        } catch (error) {

            Logger.timeEnd("BatchPlay");

            throw ErrorHandler.process(error, {
                commands
            });

        }

    }

    /**
     * Execute a single descriptor.
     */
    async single(descriptor, options = {}) {

        const result = await this.execute(
            [descriptor],
            options
        );

        return result[0];

    }

    /**
     * Execute synchronously.
     */
    async sync(descriptors) {

        return this.execute(descriptors, {
            synchronousExecution: true
        });

    }

    /**
     * Execute asynchronously.
     */
    async async(descriptors) {

        return this.execute(descriptors, {
            synchronousExecution: false
        });

    }

    /**
     * Validate descriptors before Photoshop receives them.
     */
    validate(commands) {

        if (!Array.isArray(commands))
            throw new Error(
                "BatchPlay expects an array of descriptors."
            );

        commands.forEach((descriptor, index) => {

            if (!descriptor || typeof descriptor !== "object") {

                throw new Error(
                    `Invalid BatchPlay descriptor at index ${index}.`
                );

            }

            if (!descriptor._obj) {

                throw new Error(
                    `Descriptor ${index} is missing "_obj".`
                );

            }

        });

    }

    /**
     * Convenience helper.
     */
    createDescriptor(obj, properties = {}) {

        return {
            _obj: obj,
            ...properties
        };

    }

    /**
     * Executes descriptors in chunks.
     */
    async executeInBatches(
        descriptors,
        batchSize = PHOTOSHOP.PERFORMANCE.BATCH_SIZE
    ) {

        const results = [];

        for (let i = 0; i < descriptors.length; i += batchSize) {

            const batch = descriptors.slice(
                i,
                i + batchSize
            );

            const response = await this.execute(batch);

            results.push(...response);

        }

        return results;

    }

    /**
     * Fire-and-forget execution.
     */
    executeSafe(descriptors, options = {}) {

        return this.execute(descriptors, options)
            .catch(error => {

                Logger.error(
                    "BatchPlay execution failed.",
                    error
                );

            });

    }

}

export default new BatchPlayHelper();
