import Logger from "../photoshop/Logger";

export default class AlbumSettingsManager {

    constructor() {

        this.defaults = {

            photoFit: "cover",

            exportPSD: true,

            exportJPEG: true,

            exportPDF: false,

            jpegQuality: 12,

            colorProfile: "sRGB",

            overwriteExisting: true,

            autoSave: true,

            autoSaveInterval: 30000,

            maxParallelAlbums: 1,

            namingTemplate: "{album}_{sheet}",

            ui: {

                theme: "system",

                language: "en",

                showPreview: true

            }

        };

        this.settings = structuredClone(this.defaults);

    }

    getAll() {

        return structuredClone(this.settings);

    }

    get(key) {

        return this.settings[key];

    }

    set(key, value) {

        this.settings[key] = value;

        Logger.info(`Setting updated: ${key}`);

    }

    update(values = {}) {

        this.settings = {

            ...this.settings,

            ...values

        };

        Logger.info("Settings updated.");

    }

    reset() {

        this.settings = structuredClone(this.defaults);

        Logger.info("Settings reset.");

    }

    export() {

        return JSON.stringify(

            this.settings,

            null,

            2

        );

    }

    import(json) {

        const settings = JSON.parse(json);

        this.update(settings);

    }

    validate() {

        const errors = [];

        if (

            this.settings.jpegQuality < 1 ||

            this.settings.jpegQuality > 12

        ) {

            errors.push(

                "JPEG quality must be between 1 and 12."

            );

        }

        if (

            this.settings.autoSaveInterval < 5000

        ) {

            errors.push(

                "Autosave interval must be at least 5000 ms."

            );

        }

        return {

            valid: errors.length === 0,

            errors

        };

    }

}