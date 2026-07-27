import React from "react";

import "./styles.css";

import { PanelController } from "./controllers/PanelController.jsx";
import { AlbumBrowser } from "./panels/AlbumBrowser.jsx.jsx";

import { entrypoints } from "uxp";
import { selectAllBrowserPhotos } from "./services/BrowserSelectionCommands";
import { ALBUMAI_BUILD_ID } from "./config/buildIdentity";

const albumController = new PanelController(
    () => <AlbumBrowser />,
    {
        id: "albumai",
        menuItems: [
            {
                id: "reload",
                label: "Reload AlbumAI",
                enabled: true,
                checked: false,
                oninvoke: () => location.reload()
            }
        ]
    }
);

entrypoints.setup({

    commands: {

        selectAllPhotos: selectAllBrowserPhotos

    },

    plugin: {

        create(plugin) {
            console.log("ALBUMAI_BUILD_ID", ALBUMAI_BUILD_ID);
            console.log("AlbumAI Started", plugin);
        },

        destroy() {
            console.log("AlbumAI Closed");
        }

    },

    panels: {

        albumai: albumController

    }

});
