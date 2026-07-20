import Logger from "../photoshop/Logger";

export default class AlbumHooks {

    constructor() {

        this.hooks = new Map();

    }

    register(name, callback) {

        if (!this.hooks.has(name)) {

            this.hooks.set(name, []);

        }

        this.hooks.get(name).push(callback);

        Logger.info(

            `Hook registered: ${name}`

        );

        return callback;

    }

    unregister(name, callback) {

        if (!this.hooks.has(name)) {

            return;

        }

        const callbacks =

            this.hooks.get(name);

        this.hooks.set(

            name,

            callbacks.filter(

                item => item !== callback

            )

        );

    }

    async execute(name, context = {}) {

        if (!this.hooks.has(name)) {

            return context;

        }

        let currentContext = context;

        for (const callback of this.hooks.get(name)) {

            try {

                const result = await callback(

                    currentContext

                );

                if (

                    result !== undefined

                ) {

                    currentContext = result;

                }

            }
            catch (error) {

                Logger.error(error);

            }

        }

        return currentContext;

    }

    clear(name = null) {

        if (name) {

            this.hooks.delete(name);

            return;

        }

        this.hooks.clear();

    }

    has(name) {

        return this.hooks.has(name);

    }

    count(name) {

        if (!this.hooks.has(name)) {

            return 0;

        }

        return this.hooks.get(name).length;

    }

    names() {

        return [

            ...this.hooks.keys()

        ];

    }

}