export default class DependencyContainer {

    constructor() {

        this.services = new Map();

        this.singletons = new Map();

        this.resolving = new Set();

    }

    register(name, factory, options = {}) {

        if (typeof factory !== "function") {

            throw new Error(

                `Factory for "${name}" must be a function.`

            );

        }

        this.services.set(name, {

            factory,

            singleton:

                options.singleton !== false

        });

    }

    registerSingleton(name, factory) {

        this.register(

            name,

            factory,

            {

                singleton: true

            }

        );

    }

    registerTransient(name, factory) {

        this.register(

            name,

            factory,

            {

                singleton: false

            }

        );

    }

    resolve(name) {

        if (

            this.singletons.has(name)

        ) {

            return this.singletons.get(name);

        }

        const definition =

            this.services.get(name);

        if (!definition) {

            throw new Error(

                `Service "${name}" is not registered.`

            );

        }

        if (

            this.resolving.has(name)

        ) {

            throw new Error(

                `Circular dependency detected while resolving "${name}".`

            );

        }

        this.resolving.add(name);

        try {

            const instance =

                definition.factory(this);

            if (

                definition.singleton

            ) {

                this.singletons.set(

                    name,

                    instance

                );

            }

            return instance;

        }

        finally {

            this.resolving.delete(name);

        }

    }

    has(name) {

        return this.services.has(name);

    }

    remove(name) {

        this.services.delete(name);

        this.singletons.delete(name);

    }

    clear() {

        this.services.clear();

        this.singletons.clear();

        this.resolving.clear();

    }

    list() {

        return Array.from(

            this.services.keys()

        );

    }

    getSingletons() {

        return Array.from(

            this.singletons.keys()

        );

    }

    createScope() {

        const scope =

            new DependencyContainer();

        for (const [

            name,

            definition

        ] of this.services) {

            scope.services.set(

                name,

                definition

            );

        }

        return scope;

    }

}