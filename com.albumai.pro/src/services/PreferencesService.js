import Logger from "../core/photoshop/Logger";

export default class PreferencesService {

    constructor(settingsService) {

        this.settingsService = settingsService;

    }

    get(key, defaultValue = null) {

        return this.settingsService.get(

            key,

            defaultValue

        );

    }

    set(key, value) {

        this.settingsService.set(

            key,

            value

        );

        return value;

    }

    async save() {

        await this.settingsService.save();

        Logger.info(
            "Preferences Saved."
        );

    }

    async load(defaults = {}) {

        return await this.settingsService.load(
            defaults
        );

    }

    reset(defaults = {}) {

        this.settingsService.reset(
            defaults
        );

        Logger.info(
            "Preferences Reset."
        );

    }

    all() {

        return this.settingsService.all();

    }

    has(key) {

        return this.get(key) !== null;

    }

    remove(key) {

        this.settingsService.remove(key);

    }

}