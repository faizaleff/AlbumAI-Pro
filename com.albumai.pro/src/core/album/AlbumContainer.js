import Logger from "../photoshop/Logger";

export default class AlbumContainer {

    constructor() {

        this.instances = new Map();

        this.factories = new Map();

    }

    singleton(name, factory) {

        this.factories.set(name, {

            factory,

            singleton: true

        });

        return this;

    }

    bind(name, factory) {

        this.factories.set(name, {

            factory,

            singleton: false

        });

        return this;

    }

    make(name) {

        if (this.instances.has(name)) {

            return this.instances.get(name);

        }

        const registration =

            this.factories.get(name);

        if (!registration) {

            throw new Error(

                `Service "${name}" is not registered.`

            );

        }

        const instance =

            registration.factory(this);

        if (registration.singleton) {

            this.instances.set(

                name,

                instance

            );

        }

        return instance;

    }

    has(name) {

        return this.factories.has(name);

    }

    remove(name) {

        this.instances.delete(name);

        this.factories.delete(name);

    }

    clear() {

        this.instances.clear();

        this.factories.clear();

    }

    instance(name, object) {

        this.instances.set(

            name,

            object

        );

        return object;

    }

    registered() {

        return [

            ...this.factories.keys()

        ];

    }

    singletons() {

        return [

            ...this.instances.keys()

        ];

    }

    size() {

        return this.factories.size;

    }

    dump() {

        Logger.info(

            `Container contains ${this.size()} services.`

        );

        return {

            registered:

                this.registered(),

            instantiated:

                this.singletons()

        };

    }

}