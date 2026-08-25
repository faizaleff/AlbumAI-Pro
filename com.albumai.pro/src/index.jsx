import React from "react";

import "./styles.css";

import { PanelController } from "./controllers/PanelController.jsx";
import { AlbumBrowser } from "./panels/AlbumBrowser.jsx.jsx";

import { entrypoints, storage } from "uxp";
import { selectAllBrowserPhotos } from "./services/PhotoBrowserSelection";
import {
    ALBUMAI_BUILD_ID,
    ALBUMAI_RUNTIME_REVISION_ID
} from "./config/buildIdentity";
import { characterizeOutputStorage } from "./project/OutputStorageCapabilityCharacterization";
import {
    runPhotoAiWasmFeasibilityProbe,
    runPhotoAiWasmFeasibilitySeries
} from "./services/PhotoAiWasmFeasibilityProbe";
import TypographyRuntimeQualification from "./typography/TypographyRuntimeQualification";

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

// Developer-console feasibility diagnostic only. It executes a tiny synthetic
// module over generated pixels, never reads a user photo, and never publishes
// a Photo score or opens a Photoshop document.
globalThis.__ALBUMAI_ALB070_RUN_WASM_FEASIBILITY__ = async (options = {}) => {
    const report = await runPhotoAiWasmFeasibilityProbe({
        warmRuns: options.warmRuns,
        isCancelled: typeof options.isCancelled === "function"
            ? options.isCancelled
            : undefined
    });
    console.info("ALB_070_WASM_FEASIBILITY", JSON.stringify(report));
    return report;
};

// Bounded quantitative companion to the single-run diagnostic. It aggregates
// at most twenty synthetic runs and returns only timing/count measurements.
globalThis.__ALBUMAI_ALB070_RUN_WASM_SERIES__ = async (options = {}) => {
    const report = await runPhotoAiWasmFeasibilitySeries({
        runs: options.runs,
        warmRuns: options.warmRuns,
        isCancelled: typeof options.isCancelled === "function"
            ? options.isCancelled
            : undefined
    });
    console.info("ALB_070_WASM_SERIES", JSON.stringify(report));
    return report;
};

// Developer-console diagnostic only. Inspection is read-only. Execution is
// restricted to a caller-confirmed disposable PSD, exact active document id,
// and exactly two explicit text-layer assignments. It never saves or exports.
const typographyRuntimeQualification = new TypographyRuntimeQualification();
globalThis.__ALBUMAI_ALB120_INSPECT_TYPOGRAPHY__ = () => {
    const report = typographyRuntimeQualification.inspect();
    console.info("ALB_120_TYPOGRAPHY_INSPECTION", JSON.stringify(report));
    return report;
};
globalThis.__ALBUMAI_ALB120_QUALIFY_TYPOGRAPHY__ = async (options = {}) => {
    const report = await typographyRuntimeQualification.execute(options);
    console.info("ALB_120_TYPOGRAPHY_RUNTIME_QUALIFICATION", JSON.stringify(report));
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
            console.log("ALBUMAI_RUNTIME_REVISION_ID", ALBUMAI_RUNTIME_REVISION_ID);
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
