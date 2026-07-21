import { app, core } from "photoshop";
import Logger from "./Logger";

export default class HistoryManager {

    constructor() {

        this.suspended = false;

    }

    async suspend(name, callback) {

        if (typeof callback !== "function") {

            throw new Error(
                "History callback is required."
            );

        }

        try {

            this.suspended = true;

            return await core.executeAsModal(

                async executionContext => {

                    return await executionContext.hostControl.suspendHistory({

                        documentID: app.activeDocument.id,

                        name

                    }, callback);

                },

                {

                    commandName: name

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

        finally {

            this.suspended = false;

        }

    }

    async execute(name, callback) {

        return this.suspend(

            name,

            callback

        );

    }

    async undo() {

        try {

            return await core.executeAsModal(

                async () => {

                    await app.activeDocument.undo();

                },

                {

                    commandName: "Undo"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async redo() {

        try {

            return await core.executeAsModal(

                async () => {

                    await app.activeDocument.redo();

                },

                {

                    commandName: "Redo"

                }

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async rollback(steps = 1) {

        for (let i = 0; i < steps; i++) {

            await this.undo();

        }

    }

    getActiveHistoryState() {

        return app.activeDocument
            ?.activeHistoryState;

    }

    getHistoryStates() {

        return app.activeDocument
            ?.historyStates || [];

    }

    historyCount() {

        return this.getHistoryStates().length;

    }

    isSuspended() {

        return this.suspended;

    }

}