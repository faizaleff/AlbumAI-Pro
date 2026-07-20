import { entrypoints } from "uxp";
import plugin from "./index";

entrypoints.setup({

    plugin: {

        async create() {

            await plugin.initialize();

        },

        async destroy() {

            await plugin.shutdown();

        }

    },

    panels: {

        albumai: {

            async create() {

                return {};

            },

            async show() {

            },

            async hide() {

            },

            async destroy() {

            }

        }

    },

    commands: {

        generateAlbum: {

            async run() {

                const album =
                    plugin.getAlbum();

                if (!album) {
                    return;
                }

                // UI layer will pass the actual job.
            }

        }

    }

});