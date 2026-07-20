import Logger from "../core/photoshop/Logger";

export default class SettingsService {

    constructor(storage = null) {

        this.storage = storage;

        this.settings = {};

    }

    async load(defaults = {}) {

        if (!this.storage) {

            this.settings = {

                ...defaults

            };

            return this.settings;

        }

        const saved =

            await this.storage.getItem(

                "albumai.settings"

            );

        this.settings = {

            ...defaults,

            ...(saved || {})

        };

        Logger.info(
            "Settings loaded."
        );

        return this.settings;

    }

    async save() {

        if (!this.storage)
            return;

        await this.storage.setItem(

            "albumai.settings",

            this.settings

        );

        Logger.info(
            "Settings saved."
        );

    }

    get(key, defaultValue = null) {

        return this.settings[key] ??

            defaultValue;

    }

    set(key, value) {

        this.settings[key] = value;

        return value;

    }

    remove(key) {

        delete this.settings[key];

    }

    reset(defaults = {}) {

        this.settings = {

            ...defaults

        };

    }

    all() {

        return {

            ...this.settings

        };

    }

}