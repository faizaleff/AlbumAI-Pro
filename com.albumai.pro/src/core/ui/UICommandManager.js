import AlbumEventBus from "../album/AlbumEventBus";
import Logger from "../photoshop/Logger";

export default class UICommandManager {

    constructor({

        eventBus = new AlbumEventBus(),

        services = {}

    } = {}) {

        this.eventBus = eventBus;

        this.services = services;

        this.commands = new Map();

    }

    register(name, handler) {

        if (typeof handler !== "function") {

            throw new Error(

                `Invalid handler for "${name}".`

            );

        }

        this.commands.set(

            name,

            handler

        );

    }

    unregister(name) {

        this.commands.delete(name);

    }

    has(name) {

        return this.commands.has(name);

    }

    async execute(name, payload = {}) {

        const handler =

            this.commands.get(name);

        if (!handler) {

            throw new Error(

                `Unknown command: ${name}`

            );

        }

        try {

            this.eventBus.emit(

                "command:started",

                {

                    name,

                    payload

                }

            );

            const result =

                await handler({

                    payload,

                    services:

                        this.services

                });

            this.eventBus.emit(

                "command:completed",

                {

                    name,

                    result

                }

            );

            return result;

        }

        catch (error) {

            Logger.error(error);

            this.eventBus.emit(

                "command:failed",

                {

                    name,

                    error

                }

            );

            throw error;

        }

    }

    registerDefaults() {

        this.register(

            "project:new",

            ({ services, payload }) =>

                services.projectManager.create(

                    payload

                )

        );

        this.register(

            "project:save",

            ({ services, payload }) =>

                services.projectManager.save(

                    payload.folder

                )

        );

        this.register(

            "album:generate",

            ({ services, payload }) =>

                services.albumEngine.generate(

                    payload

                )

        );

        this.register(

            "album:cancel",

            ({ services }) =>

                services.albumEngine.cancel()

        );

        this.register(

            "export:start",

            ({ services, payload }) =>

                services.exportManager.export(

                    payload.project,

                    payload.callbacks

                )

        );

    }

    list() {

        return Array.from(

            this.commands.keys()

        );

    }

}