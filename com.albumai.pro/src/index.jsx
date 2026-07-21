import React from "react";

import "./styles.css";

import { PanelController } from "./controllers/PanelController.jsx";
import { AlbumBrowser } from "./panels/AlbumBrowser.jsx.jsx";

import { entrypoints } from "uxp";

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

    plugin: {

        create(plugin) {
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
