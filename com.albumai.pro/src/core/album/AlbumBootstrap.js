import Logger from "../photoshop/Logger";

import AlbumConfigurationManager from "./AlbumConfigurationManager";
import AlbumPreferencesManager from "./AlbumPreferencesManager";
import AlbumMetadataManager from "./AlbumMetadataManager";
import AlbumContextManager from "./AlbumContextManager";
import AlbumProjectManager from "./AlbumProjectManager";
import AlbumLifecycleManager from "./AlbumLifecycleManager";
import AlbumValidationService from "./AlbumValidationService";
import TemplateManager from "./TemplateManager";

export default class AlbumBootstrap {

    constructor() {

        this.services = {};

        this.initialized = false;

    }

    initialize() {

        if (this.initialized) {

            return this.services;

        }

        this.services.configuration =
            new AlbumConfigurationManager();

        this.services.preferences =
            new AlbumPreferencesManager();

        this.services.metadata =
            new AlbumMetadataManager();

        this.services.context =
            new AlbumContextManager();

        this.services.project =
            new AlbumProjectManager();

        this.services.lifecycle =
            new AlbumLifecycleManager();

        this.services.validation =
            new AlbumValidationService();

        this.services.templates =
            new TemplateManager();

        this.services.lifecycle.initialize();

        this.initialized = true;

        Logger.info(
            "Album bootstrap initialized."
        );

        return this.services;

    }

    get(name) {

        return this.services[name];

    }

    has(name) {

        return Object.prototype.hasOwnProperty.call(

            this.services,

            name

        );

    }

    all() {

        return this.services;

    }

    shutdown() {

        if (

            this.services.lifecycle

        ) {

            this.services.lifecycle.reset();

        }

        this.services = {};

        this.initialized = false;

        Logger.info(
            "Album bootstrap shutdown."
        );

    }

}