import AlbumEventBus from "../album/AlbumEventBus";
import Logger from "../photoshop/Logger";

export default class PluginLifecycleManager {

    constructor({

        bootstrap,

        eventBus = new AlbumEventBus(),

        version = "1.0.0"

    } = {}) {

        this.bootstrap = bootstrap;

        this.eventBus = eventBus;

        this.version = version;

        this.state = "created";

        this.services = null;

        this.startedAt = null;

        this.healthTimer = null;

    }

    async startup() {

        if (this.state === "running") {

            return this.services;

        }

        try {

            this.transition("starting");

            Logger.info("Plugin startup...");

            await this.runMigration();

            await this.restoreSession();

            this.services =

                await this.bootstrap.initialize();

            this.registerGlobalEvents();

            this.startHealthMonitor();

            this.startedAt = Date.now();

            this.transition("running");

            this.eventBus.emit(

                "plugin:started",

                {

                    version: this.version,

                    startedAt: this.startedAt

                }

            );

            return this.services;

        }

        catch (error) {

            this.transition("failed");

            Logger.error(error);

            throw error;

        }

    }

    async shutdown() {

        if (

            this.state !== "running"

        ) {

            return;

        }

        try {

            this.transition("stopping");

            this.stopHealthMonitor();

            await this.saveSession();

            await this.bootstrap.shutdown();

            this.services = null;

            this.transition("stopped");

            this.eventBus.emit(

                "plugin:stopped"

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async suspend() {

        this.transition("suspended");

        this.stopHealthMonitor();

        this.eventBus.emit(

            "plugin:suspended"

        );

    }

    async resume() {

        this.transition("running");

        this.startHealthMonitor();

        this.eventBus.emit(

            "plugin:resumed"

        );

    }

    async restoreSession() {

        this.eventBus.emit(

            "plugin:restore"

        );

    }

    async saveSession() {

        this.eventBus.emit(

            "plugin:save"

        );

    }

    async recover(error) {

        Logger.error(error);

        this.eventBus.emit(

            "plugin:recovery",

            error

        );

    }

    async runMigration() {

        this.eventBus.emit(

            "plugin:migration",

            {

                version: this.version

            }

        );

    }

    registerGlobalEvents() {

        if (

            typeof window === "undefined"

        ) {

            return;

        }

        window.addEventListener(

            "beforeunload",

            () => {

                this.shutdown();

            }

        );

        window.addEventListener(

            "error",

            event => {

                this.recover(

                    event.error

                );

            }

        );

    }

    startHealthMonitor(interval = 30000) {

        this.stopHealthMonitor();

        this.healthTimer = setInterval(

            () => {

                this.eventBus.emit(

                    "plugin:health",

                    this.health()

                );

            },

            interval

        );

    }

    stopHealthMonitor() {

        if (this.healthTimer) {

            clearInterval(

                this.healthTimer

            );

            this.healthTimer = null;

        }

    }

    health() {

        return {

            state: this.state,

            version: this.version,

            uptime:

                this.startedAt

                    ? Date.now() -

                      this.startedAt
                    : 0,

            running:

                this.state ===

                "running"

        };

    }

    transition(state) {

        this.state = state;

        this.eventBus.emit(

            "plugin:state",

            state

        );

    }

    getState() {

        return this.state;

    }

}