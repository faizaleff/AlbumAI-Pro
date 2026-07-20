import Logger from "./photoshop/Logger";

export default class ResourceManager {

    constructor() {

        this.resources = new Map();

    }

    register(name, resource) {

        if (!name)
            throw new Error(
                "Resource name required."
            );

        this.resources.set(
            name,
            resource
        );

        Logger.debug(
            `Resource Registered: ${name}`
        );

        return resource;

    }

    get(name) {

        return this.resources.get(name);

    }

    has(name) {

        return this.resources.has(name);

    }

    remove(name) {

        const resource =
            this.resources.get(name);

        if (

            resource &&

            typeof resource.dispose ===
            "function"

        ) {

            resource.dispose();

        }

        this.resources.delete(name);

    }

    clear() {

        for (const resource of this.resources.values()) {

            if (

                resource &&

                typeof resource.dispose ===
                "function"

            ) {

                resource.dispose();

            }

        }

        this.resources.clear();

        Logger.info(
            "Resources released."
        );

    }

    size() {

        return this.resources.size;

    }

    keys() {

        return [

            ...this.resources.keys()

        ];

    }

    values() {

        return [

            ...this.resources.values()

        ];

    }

    entries() {

        return [

            ...this.resources.entries()

        ];

    }

}