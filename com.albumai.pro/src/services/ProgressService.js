import Logger from "../core/photoshop/Logger";

export default class ProgressService {

    constructor() {

        this.callback = null;
        this.progress = 0;
        this.stage = "";
    }

    setCallback(callback) {

        this.callback = callback;

    }

    update(stage, value, data = {}) {

        this.stage = stage;
        this.progress = value;

        const payload = {
            stage,
            value,
            ...data
        };

        if (typeof this.callback === "function") {

            try {

                this.callback(payload);

            }

            catch (error) {

                Logger.error(error);

            }

        }

        Logger.debug(
            `[${value}%] ${stage}`
        );

    }

    start(total = 100) {

        this.update("Starting", 0, {
            total
        });

    }

    finish() {

        this.update("Completed", 100);

    }

    error(error) {

        this.update("Error", this.progress, {
            error
        });

    }

    reset() {

        this.progress = 0;
        this.stage = "";

    }

    getProgress() {

        return this.progress;

    }

    getStage() {

        return this.stage;

    }

}