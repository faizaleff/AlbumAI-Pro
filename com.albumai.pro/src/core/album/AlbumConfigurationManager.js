import Logger from "../photoshop/Logger";
import AlbumConfiguration from "./AlbumConfiguration";

export default class AlbumConfigurationManager {

    constructor(defaults = {}) {

        this.configuration =
            new AlbumConfiguration(defaults);

    }

    get(key, defaultValue = null) {

        return this.configuration.get(

            key,

            defaultValue

        );

    }

    set(key, value) {

        const result =
            this.configuration.set(key, value);

        Logger.info(

            `Configuration updated: ${key}`

        );

        return result;

    }

    has(key) {

        return this.configuration.has(key);

    }

    update(values = {}) {

        return this.configuration.update(values);

    }

    reset() {

        return this.configuration.reset();

    }

    all() {

        return this.configuration.all();

    }

    export() {

        return this.configuration.export();

    }

    import(data = {}) {

        return this.configuration.import(data);

    }

    enable(key) {

        return this.set(key, true);

    }

    disable(key) {

        return this.set(key, false);

    }

    toggle(key) {

        const value =

            !this.get(key, false);

        this.set(key, value);

        return value;

    }

    isEnabled(key) {

        return this.get(key) === true;

    }

}