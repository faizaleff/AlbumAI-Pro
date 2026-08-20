import assert from "assert";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
    PrintPresetType,
    StandardAlbumSizes,
    BleedPreset,
    calculatePrintDimensions,
    preflightAlbumForPrint,
    generatePdfProofManifest
} from "../src/services/PrintExportPresetEngine";
import PrintProofModal from "../src/components/PrintProofModal";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb090Tests() {
    console.info("Starting ALB-090 Print Export & PDF Proofing Engine tests...");

    // Test 1: calculatePrintDimensions (12x12 no bleed vs 0.125" bleed)
    {
        const noBleed = calculatePrintDimensions(StandardAlbumSizes.SIZE_12X12, BleedPreset.NONE, 300);
        check(noBleed.totalWidthPx === 3600, "12x12 no bleed width is 3600px");
        check(noBleed.totalHeightPx === 3600, "12x12 no bleed height is 3600px");
        check(noBleed.bleedPxPerSide === 0, "No bleed px per side is 0");
        check(noBleed.trimBox.width === 3600 && noBleed.trimBox.height === 3600, "Trim box matches base dimensions");

        const standardBleed = calculatePrintDimensions(StandardAlbumSizes.SIZE_12X12, BleedPreset.STANDARD_0125, 300);
        check(standardBleed.totalWidthPx === 3675, "12x12 with 0.125 bleed width is 3675px (3600 + 75)");
        check(standardBleed.totalHeightPx === 3675, "12x12 with 0.125 bleed height is 3675px (3600 + 75)");
        check(standardBleed.bleedPxPerSide === 38 || standardBleed.bleedPxPerSide === 37.5 || standardBleed.bleedPxPerSide === 38, "Bleed px per side is ~38px");
        check(standardBleed.safeBox.width > 0 && standardBleed.safeBox.height > 0, "Safe box has positive dimensions");
    }

    // Test 2: calculatePrintDimensions (12x18 panoramic & 8.5x11 magazine)
    {
        const panoramic = calculatePrintDimensions(StandardAlbumSizes.SIZE_12X18, BleedPreset.STANDARD_0125, 300);
        check(panoramic.totalWidthPx === 5475, "12x18 with 0.125 bleed width is 5475px");
        check(panoramic.totalHeightPx === 3675, "12x18 with 0.125 bleed height is 3675px");

        const magazine = calculatePrintDimensions(StandardAlbumSizes.SIZE_8X11, BleedPreset.NONE, 300);
        check(magazine.totalWidthPx === 3300, "8.5x11 width is 3300px");
        check(magazine.totalHeightPx === 2550, "8.5x11 height is 2550px");
    }

    // Test 3: preflightAlbumForPrint (Missing slots detection)
    {
        const album = {
            sheets: [
                {
                    id: "sheet-1",
                    templateId: "t-2-slots",
                    slots: [{ slotId: 1, photoId: "p1" }] // 1 slot filled, 1 missing
                }
            ]
        };
        const templates = [
            { id: "t-2-slots", name: "2-Slot Template", smartObjects: [{ layerId: 1 }, { layerId: 2 }] }
        ];
        const photos = [
            { id: "p1", name: "Photo1.jpg", width: 4000, height: 3000 }
        ];

        const preflight = preflightAlbumForPrint({
            album,
            photos,
            templates,
            sizePreset: StandardAlbumSizes.SIZE_12X12
        });

        check(preflight.totalSheets === 1, "Total sheets is 1");
        check(preflight.totalSlots === 2, "Total expected slots is 2");
        check(preflight.filledSlots === 1, "Filled slots is 1");
        check(preflight.unfilledSlots === 1, "Unfilled slots is 1");
        check(preflight.isReadyForPrint === false, "isReadyForPrint is false due to missing slot");
        check(preflight.unfilledSlotDetails.length === 1, "Reports 1 unfilled sheet detail");
    }

    // Test 4: preflightAlbumForPrint (Low resolution warning detection)
    {
        const album = {
            sheets: [
                {
                    id: "sheet-1",
                    templateId: "t-1-hero",
                    slots: [{ slotId: 1, photoId: "p-lowres" }]
                }
            ]
        };
        const templates = [
            { id: "t-1-hero", name: "1-Hero Template", smartObjects: [{ layerId: 1 }] }
        ];
        const photos = [
            { id: "p-lowres", name: "TinyThumbnail.jpg", width: 800, height: 600 } // 800px on 12" spread -> ~67 DPI (<200)
        ];

        const preflight = preflightAlbumForPrint({
            album,
            photos,
            templates,
            sizePreset: StandardAlbumSizes.SIZE_12X12
        });

        check(preflight.isReadyForPrint === true, "All slots are filled");
        check(preflight.lowResolutionWarnings.length === 1, "Detected 1 low resolution warning");
        check(preflight.lowResolutionWarnings[0].photoName === "TinyThumbnail.jpg", "Identified TinyThumbnail.jpg");
        check(preflight.lowResolutionWarnings[0].effectiveDpi < 200, "Effective DPI is below 200");
    }

    // Test 5: generatePdfProofManifest
    {
        const album = {
            id: "wedding-album-2026",
            sheets: [
                { id: "sheet-1", label: "Cover Spread", templateId: "t1", slots: [{ slotId: 1, photoId: "p1" }] },
                { id: "sheet-2", label: "Ceremony", templateId: "t1", slots: [{ slotId: 1, photoId: "p2" }] }
            ]
        };
        const photos = [
            { id: "p1", name: "Cover.jpg" },
            { id: "p2", name: "Vows.jpg" }
        ];
        const templates = [
            { id: "t1", name: "Standard 1-Up" }
        ];

        const manifest = generatePdfProofManifest({
            album,
            photos,
            templates,
            proofConfig: {
                watermarkText: "CONFIDENTIAL PROOF",
                includePageNumbers: true,
                clientName: "Alice & Bob"
            }
        });

        check(manifest.schemaVersion === 1, "Schema version is 1");
        check(manifest.albumId === "wedding-album-2026", "Album ID matches");
        check(manifest.totalPages === 2, "Total pages is 2");
        check(manifest.watermarkText === "CONFIDENTIAL PROOF", "Watermark text matches");
        check(manifest.hasWatermark === true, "hasWatermark is true");
        check(manifest.clientName === "Alice & Bob", "Client name matches");
        check(manifest.pages.length === 2, "Contains 2 page descriptors");
        check(manifest.pages[0].label === "Cover Spread", "Page 1 label is Cover Spread");
        check(manifest.pages[0].pageIndicator === "Spread 1 of 2", "Page 1 indicator matches");
        check(manifest.pages[1].slots[0].photoName === "Vows.jpg", "Page 2 photo name is Vows.jpg");
    }

    // Test 6: PrintProofModal Server-Side Rendering
    {
        const album = {
            sheets: [
                { id: "sheet-1", label: "Intro", templateId: "t1", slots: [{ slotId: 1, photoId: "p1" }] }
            ]
        };
        const photos = [{ id: "p1", name: "Shot.jpg", width: 4000, height: 3000 }];
        const templates = [{ id: "t1", name: "Single Spread", smartObjects: [{ layerId: 1 }] }];

        const html = ReactDOMServer.renderToStaticMarkup(
            <PrintProofModal
                isOpen={true}
                onClose={() => {}}
                album={album}
                photos={photos}
                templates={templates}
                onExportPrint={() => {}}
            />
        );

        check(typeof html === "string" && html.length > 0, "PrintProofModal rendered to HTML");
        check(html.includes("Print Export &amp; PDF Proofing Engine") || html.includes("Print Export & PDF Proofing Engine"), "Contains modal title");
        check(html.includes("300 DPI Lab Print Profile"), "Contains Lab Print preset");
        check(html.includes("Multi-Page Client PDF Proof"), "Contains PDF proof preset");
        check(html.includes("Preflight Quality Checklist"), "Contains preflight checklist");
        check(html.includes("Export Lab Print Batch"), "Contains Export Print button");
        check(html.includes("Generate PDF Proof Sheet"), "Contains Generate PDF Proof button");
    }

    // Test 7: PrintProofModal SSR with Incomplete Spread disables Lab Print button
    {
        const album = {
            sheets: [
                { id: "sheet-1", label: "Spread 1", templateId: "t2", slots: [{ slotId: 1, photoId: "p1" }] } // 1 of 2 slots filled
            ]
        };
        const photos = [{ id: "p1", name: "Shot.jpg", width: 4000, height: 3000 }];
        const templates = [{ id: "t2", name: "Double Spread", smartObjects: [{ layerId: 1 }, { layerId: 2 }] }];

        const html = ReactDOMServer.renderToStaticMarkup(
            <PrintProofModal
                isOpen={true}
                onClose={() => {}}
                album={album}
                photos={photos}
                templates={templates}
                onExportPrint={() => {}}
            />
        );

        check(html.includes("Lab Print Batch is blocked until all slots are assigned"), "Preflight explains Lab Print Batch is blocked");
        check(html.includes("Spread 1: 1/2 assigned (1 empty)"), "Preflight details exact assigned/total count for Spread 1");
        // Verify primary button is disabled for incomplete layout
        check(html.includes("Export Lab Print Batch") && html.includes("disabled"), "Export Lab Print Batch button is disabled");
    }

    console.info(`PASS ALB-090: All assertions passed (${assertions} assertions).`);
}

runAlb090Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
