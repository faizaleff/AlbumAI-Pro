import Logger from "../core/photoshop/Logger";

export default class ConfigurationService {

    constructor() {

        this.defaults = {

            exportFormat: "jpg",

            jpegQuality: 12,

            overwrite: false,

            autoSave: true,

            keepTemplateOpen: false,

            exportPSD: true,

            exportJPEG: true,

            exportPNG: false,

            exportPDF: false

        };

        this.config = {
            ...this.defaults
        };

    }

    load(config = {}) {

        this.config = {

            ...this.defaults,

            ...config

        };

        Logger.info(
            "Configuration loaded."
        );

        return this.config;

    }

    reset() {

        this.config = {

            ...this.defaults

        };

    }

    get(key) {

        return this.config[key];

    }

    set(key, value) {

        this.config[key] = value;

    }

    has(key) {

        return Object.prototype.hasOwnProperty.call(

            this.config,

            key

        );

    }

    remove(key) {

        delete this.config[key];

    }

    all() {

        return {

            ...this.config

        };

    }

    merge(config = {}) {

        this.config = {

            ...this.config,

            ...config

        };

        return this.config;

    }

}