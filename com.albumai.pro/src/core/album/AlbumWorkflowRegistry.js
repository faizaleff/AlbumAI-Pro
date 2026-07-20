import Logger from "../photoshop/Logger";

export default class AlbumWorkflowRegistry {

    constructor() {

        this.registry = new Map();

    }

    register(name, workflow) {

        if (!name) {

            throw new Error(
                "Workflow name is required."
            );

        }

        this.registry.set(

            name,

            workflow

        );

        Logger.info(

            `Workflow registered: ${name}`

        );

        return workflow;

    }

    get(name) {

        return this.registry.get(name);

    }

    has(name) {

        return this.registry.has(name);

    }

    unregister(name) {

        const removed =

            this.registry.delete(name);

        if (removed) {

            Logger.info(

                `Workflow removed: ${name}`

            );

        }

        return removed;

    }

    clear() {

        this.registry.clear();

        Logger.info(

            "Workflow registry cleared."

        );

    }

    count() {

        return this.registry.size;

    }

    names() {

        return [

            ...this.registry.keys()

        ];

    }

    values() {

        return [

            ...this.registry.values()

        ];

    }

    entries() {

        return [

            ...this.registry.entries()

        ];

    }

    forEach(callback) {

        this.registry.forEach(

            callback

        );

    }

    export() {

        return Object.fromEntries(

            this.registry.entries()

        );

    }

}