import Logger from "../photoshop/Logger";
import AlbumContext from "./AlbumContext";

export default class AlbumContextManager {

    constructor(initialContext = {}) {

        this.context = new AlbumContext(initialContext);

    }

    set(key, value) {

        return this.context.set(key, value);

    }

    get(key, defaultValue = null) {

        return this.context.get(key, defaultValue);

    }

    has(key) {

        return this.context.has(key);

    }

    remove(key) {

        return this.context.remove(key);

    }

    merge(values = {}) {

        this.context.merge(values);

        Logger.info("Album context updated.");

        return this.context.toObject();

    }

    increment(key, amount = 1) {

        this.context.increment(key, amount);

    }

    decrement(key, amount = 1) {

        this.context.decrement(key, amount);

    }

    clear() {

        this.context.clear();

        Logger.info("Album context cleared.");

    }

    reset() {

        this.context.reset();

    }

    keys() {

        return this.context.keys();

    }

    values() {

        return this.context.values();

    }

    entries() {

        return this.context.entries();

    }

    export() {

        return this.context.toObject();

    }

    import(data = {}) {

        this.context.clear();

        this.context.merge(data);

        Logger.info("Album context imported.");

        return this.context.toObject();

    }

}