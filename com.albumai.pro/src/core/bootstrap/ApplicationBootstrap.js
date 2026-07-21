import AlbumEventBus from "../album/AlbumEventBus";

import UIController from "../ui/UIController";

import AlbumProjectManager from "../album/AlbumProjectManager";
import AlbumGenerationEngine from "../album/AlbumGenerationEngine";
import ExportManager from "../export/ExportManager";
import AlbumSettingsManager from "../album/AlbumSettingsManager";
import AlbumPreferencesManager from "../album/AlbumPreferencesManager";

import Logger from "../photoshop/Logger";

export default class ApplicationBootstrap {

    constructor({

        version = "1.0.0"

    } = {}) {

        this.version = version;

        this.eventBus = new AlbumEventBus();

        this.services = {};

        this.initialized = false;

    }

    async initialize() {

        if (this.initialized) {

            return this.services;

        }

        try {

            Logger.info(

                "AlbumAI Pro Bootstrapping..."

            );

            await this.initializeCore();

            await this.initializeUI();

            await this.loadPreferences();

            await this.healthCheck();

            this.registerGlobalEvents();

            this.initialized = true;

            this.eventBus.emit(

                "application:ready",

                {

                    version: this.version

                }

            );

            Logger.info(

                "AlbumAI Pro Ready."

            );

            return this.services;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async initializeCore() {

        this.services.settingsManager =

            new AlbumSettingsManager();

        this.services.preferencesManager =

            new AlbumPreferencesManager();

        this.services.projectManager =

            new AlbumProjectManager();

        this.services.albumEngine =

            new AlbumGenerationEngine();

        this.services.exportManager =

            new ExportManager();

    }

    async initializeUI() {

        this.services.ui =

            new UIController({

                services: this.services

            });

        this.services.ui.initialize();

    }

    async loadPreferences() {

        const manager =

            this.services.preferencesManager;

        if (

            manager &&

            typeof manager.load ===

            "function"

        ) {

            await manager.load();

        }

    }

    async healthCheck() {

        const report = {

            version: this.version,

            initialized:

                this.initialized,

            services:

                Object.keys(

                    this.services

                ),

            timestamp:

                Date.now()

        };

        this.eventBus.emit(

            "application:health",

            report

        );

        return report;

    }

    registerGlobalEvents() {

        if (

            typeof window !==

            "undefined"

        ) {

            window.addEventListener(

                "error",

                event => {

                    Logger.error(

                        event.error

                    );

                }

            );

        }

    }

    getService(name) {

        return this.services[name];

    }

    getServices() {

        return {

            ...this.services

        };

    }

    isInitialized() {

        return this.initialized;

    }

    async shutdown() {

        if (!this.initialized) {

            return;

        }

        try {

            if (

                this.services.ui &&

                typeof this.services.ui.destroy ===

                "function"

            ) {

                this.services.ui.destroy();

            }

            this.eventBus.emit(

                "application:shutdown"

            );

            this.services = {};

            this.initialized = false;

            Logger.info(

                "AlbumAI Pro Shutdown Complete."

            );

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

}