import React from "react";

import "./styles.css";

import { PanelController } from "./controllers/PanelController.jsx";
import { AlbumBrowser } from "./panels/AlbumBrowser.jsx.jsx";

import { entrypoints, storage } from "uxp";
import { selectAllBrowserPhotos } from "./services/PhotoBrowserSelection";
import { ALBUMAI_BUILD_ID } from "./config/buildIdentity";
import { characterizeOutputStorage } from "./project/OutputStorageCapabilityCharacterization";

// Developer-console diagnostic only. It prompts for a parent folder and uses
// a newly-created AlbumAI-owned disposable child folder; it never opens PSDs.
globalThis.__ALBUMAI_ALB045_CHARACTERIZE_OUTPUT_STORAGE__ = async () => {
    const parentFolder = await storage.localFileSystem.getFolder();
    if (!parentFolder) return null;
    const formats = storage.formats;
    const report = await characterizeOutputStorage({
        parentFolder,
        binaryReader: entry => entry.read({ format: formats?.binary })
    });
    console.info("ALB_045_OUTPUT_STORAGE_CAPABILITIES", report);
    return report;
};

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
