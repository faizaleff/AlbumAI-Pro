import {
    APP_NAME,
    APP_VERSION
} from "./constants";

import UI from "./ui";

const MANIFEST = Object.freeze({

    id: "com.albumai.pro",

    name: APP_NAME,

    version: APP_VERSION,

    manifestVersion: 5,

    host: {

        app: "PS",

        minVersion: "27.0.0"

    },

    entrypoints: [

        {

            type: "command",

            id: "generateAlbum",

            label: "Generate Album"

        },

        {

            type: "panel",

            id: UI.PANEL_ID,

            label: UI.PANEL_TITLE,

            minimumSize: {

                width: 320,

                height: 500

            },

            maximumSize: {

                width: 1600,

                height: 1600

            },

            preferredDockedSize: {

                width: UI.PANEL_WIDTH,

                height: UI.PANEL_HEIGHT

            },

            preferredFloatingSize: {

                width: UI.PANEL_WIDTH,

                height: UI.PANEL_HEIGHT

            }

        }

    ]

});

export default MANIFEST;