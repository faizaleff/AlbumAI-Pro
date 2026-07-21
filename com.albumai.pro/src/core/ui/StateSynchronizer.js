import AlbumEventBus from "../album/AlbumEventBus";
import Logger from "../photoshop/Logger";

export default class StateSynchronizer {

    constructor({

        eventBus = new AlbumEventBus(),

        stateManager = null

    } = {}) {

        this.eventBus = eventBus;

        this.stateManager = stateManager;

        this.sources = new Map();

        this.subscribers = new Set();

        this.syncEnabled = true;

    }

    registerSource(name, source) {

        this.sources.set(name, source);

    }

    unregisterSource(name) {

        this.sources.delete(name);

    }

    getSource(name) {

        return this.sources.get(name);

    }

    subscribe(callback) {

        if (typeof callback !== "function") {

            throw new Error(

                "Subscriber must be a function."

            );

        }

        this.subscribers.add(callback);

        return () => {

            this.subscribers.delete(callback);

        };

    }

    notify(change) {

        if (!this.syncEnabled) {

            return;

        }

        for (const subscriber of this.subscribers) {

            try {

                subscriber(change);

            }

            catch (error) {

                Logger.error(error);

            }

        }

        this.eventBus.emit(

            "state:synchronized",

            change

        );

    }

    synchronize(sourceName, changes = {}) {

        if (!this.syncEnabled) {

            return;

        }

        if (this.stateManager) {

            this.stateManager.update(

                changes

            );

        }

        this.notify({

            source: sourceName,

            changes,

            timestamp: Date.now()

        });

    }

    synchronizeAll() {

        for (const [

            name,

            source

        ] of this.sources) {

            if (

                typeof source.getState !==

                "function"

            ) {

                continue;

            }

            this.synchronize(

                name,

                source.getState()

            );

        }

    }

    enable() {

        this.syncEnabled = true;

    }

    disable() {

        this.syncEnabled = false;

    }

    isEnabled() {

        return this.syncEnabled;

    }

    clearSubscribers() {

        this.subscribers.clear();

    }

    clearSources() {

        this.sources.clear();

    }

    destroy() {

        this.clearSubscribers();

        this.clearSources();

        this.disable();

    }

}