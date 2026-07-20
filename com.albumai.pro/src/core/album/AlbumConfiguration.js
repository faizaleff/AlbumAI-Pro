import Logger from "../photoshop/Logger";

export default class AlbumConfiguration {

    constructor(defaults = {}) {

        this.defaults = {

            quality: "high",

            imageFormat: "jpg",

            jpegQuality: 12,

            overwriteExisting: false,

            autoSave: true,

            smartCrop: true,

            preserveAspectRatio: true,

            exportPSD: false,

            exportJPEG: true,

            exportPNG: false,

            maxConcurrentJobs: 2,

            ...defaults

        };

        this.settings = {

            ...this.defaults

        };

    }

    get(key, defaultValue = null) {

        return this.settings.hasOwnProperty(key)

            ? this.settings[key]

            : defaultValue;

    }

    set(key, value) {

        this.settings[key] = value;

        return value;

    }

    has(key) {

        return this.settings.hasOwnProperty(key);

    }

    update(values = {}) {

        Object.assign(

            this.settings,

            values

        );

        Logger.info(

            "Album configuration updated."

        );

        return this.settings;

    }

    reset() {

        this.settings = {

            ...this.defaults

        };

        Logger.info(

            "Album configuration reset."

        );

        return this.settings;

    }

    all() {

        return {

            ...this.settings

        };

    }

    export() {

        return JSON.stringify(

            this.settings,

            null,

            2

        );

    }

    import(data = {}) {

        this.settings = {

            ...this.defaults,

            ...data

        };

        Logger.info(

            "Album configuration imported."

        );

        return this.settings;

    }

}