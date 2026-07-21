import Logger from "../photoshop/Logger";

export default class AlbumAutosaveManager {

    constructor({

        projectManager = null,

        recoveryManager = null,

        interval = 30000

    } = {}) {

        this.projectManager = projectManager;

        this.recoveryManager = recoveryManager;

        this.interval = interval;

        this.timer = null;

        this.enabled = false;

        this.folder = null;

    }

    async start(folder) {

        if (this.enabled) {

            return;

        }

        this.folder = folder;

        this.enabled = true;

        this.timer = setInterval(

            async () => {

                try {

                    await this.save();

                }

                catch (error) {

                    Logger.error(error);

                }

            },

            this.interval

        );

        Logger.info("Autosave started.");

    }

    stop() {

        if (this.timer) {

            clearInterval(this.timer);

            this.timer = null;

        }

        this.enabled = false;

        Logger.info("Autosave stopped.");

    }

    async save() {

        if (!this.folder) {

            return;

        }

        if (

            this.projectManager &&

            this.projectManager.get()

        ) {

            await this.projectManager.save(

                this.folder

            );

        }

        if (

            this.recoveryManager &&

            this.recoveryManager.hasRecovery()

        ) {

            await this.recoveryManager.save(

                this.folder

            );

        }

        Logger.info("Autosave completed.");

    }

    setInterval(interval) {

        this.interval = interval;

        if (this.enabled) {

            this.stop();

            this.start(this.folder);

        }

    }

    getInterval() {

        return this.interval;

    }

    isRunning() {

        return this.enabled;

    }

}