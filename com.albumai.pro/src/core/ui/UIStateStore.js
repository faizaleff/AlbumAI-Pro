import AlbumEventBus from "../album/AlbumEventBus";
import Logger from "../photoshop/Logger";

export default class UIStateStore {

    constructor({

        eventBus = new AlbumEventBus(),

        initialState = {},

        historyLimit = 100

    } = {}) {

        this.eventBus = eventBus;

        this.historyLimit = historyLimit;

        this.listeners = new Set();

        this.history = [];

        this.future = [];

        this.state = {

            ...initialState

        };

    }

    getState() {

        return structuredClone(

            this.state

        );

    }

    get(path) {

        if (!path) {

            return this.getState();

        }

        return path

            .split(".")

            .reduce(

                (value, key) =>

                    value?.[key],

                this.state

            );

    }

    set(path, value) {

        this.saveSnapshot();

        const keys = path.split(".");

        let target = this.state;

        while (keys.length > 1) {

            const key = keys.shift();

            if (!(key in target)) {

                target[key] = {};

            }

            target = target[key];

        }

        target[keys[0]] = value;

        this.emit();

    }

    update(values = {}) {

        this.saveSnapshot();

        this.state = {

            ...this.state,

            ...values

        };

        this.emit();

    }

    dispatch(action) {

        if (

            !action ||

            typeof action.type !== "string"

        ) {

            throw new Error(

                "Invalid action."

            );

        }

        this.eventBus.emit(

            "store:action",

            action

        );

        return action;

    }

    subscribe(listener) {

        if (typeof listener !== "function") {

            throw new Error(

                "Listener must be a function."

            );

        }

        this.listeners.add(listener);

        return () =>

            this.listeners.delete(listener);

    }

    emit() {

        const snapshot = this.getState();

        this.listeners.forEach(listener => {

            try {

                listener(snapshot);

            }

            catch (error) {

                Logger.error(error);

            }

        });

        this.eventBus.emit(

            "store:changed",

            snapshot

        );

    }

    saveSnapshot() {

        this.history.push(

            structuredClone(this.state)

        );

        if (

            this.history.length >

            this.historyLimit

        ) {

            this.history.shift();

        }

        this.future = [];

    }

    undo() {

        if (

            this.history.length === 0

        ) {

            return false;

        }

        this.future.push(

            structuredClone(this.state)

        );

        this.state = this.history.pop();

        this.emit();

        return true;

    }

    redo() {

        if (

            this.future.length === 0

        ) {

            return false;

        }

        this.history.push(

            structuredClone(this.state)

        );

        this.state = this.future.pop();

        this.emit();

        return true;

    }

    reset(state = {}) {

        this.history = [];

        this.future = [];

        this.state = {

            ...state

        };

        this.emit();

    }

    clearHistory() {

        this.history = [];

        this.future = [];

    }

}