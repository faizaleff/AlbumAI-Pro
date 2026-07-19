// src/core/photoshop/ExecuteModal.js

import { core } from "photoshop";

import Logger from "./Logger.js";
import ErrorHandler from "./ErrorHandler.js";
import PHOTOSHOP from "./Constants.js";

class ExecuteModal {

    constructor() {
        this.running = false;
        this.queue = [];
    }

    async run(task, options = {}) {

        return new Promise((resolve, reject) => {

            this.queue.push({
                task,
                options,
                resolve,
                reject
            });

            this.processQueue();
        });

    }

    async processQueue() {

        if (this.running)
            return;

        const next = this.queue.shift();

        if (!next)
            return;

        this.running = true;

        const {
            task,
            options,
            resolve,
            reject
        } = next;

        const commandName =
            options.commandName ||
            PHOTOSHOP.HISTORY_NAME;

        const timeout =
            options.timeout ??
            PHOTOSHOP.PERFORMANCE.MODAL_TIMEOUT;

        Logger.separator();
        Logger.info(`Modal Started : ${commandName}`);

        const timer = setTimeout(() => {

            Logger.warn(
                `Modal timeout (${timeout} ms): ${commandName}`
            );

        }, timeout);

        Logger.time(commandName);

        try {

            const result =
                await ErrorHandler.execute(async () => {

                    return await core.executeAsModal(

                        async (executionContext) => {

                            return await task(executionContext);

                        },

                        {
                            commandName
                        }

                    );

                }, {
                    commandName
                });

            Logger.timeEnd(commandName);

            Logger.info(`Modal Finished : ${commandName}`);

            resolve(result);

        } catch (error) {

            Logger.timeEnd(commandName);

            Logger.error(
                `Modal Failed : ${commandName}`
            );

            reject(error);

        } finally {

            clearTimeout(timer);

            this.running = false;

            this.processQueue();

        }

    }

    get isBusy() {
        return this.running;
    }

    get pending() {
        return this.queue.length;
    }

    clearQueue() {
        this.queue = [];
    }

}

export default new ExecuteModal();