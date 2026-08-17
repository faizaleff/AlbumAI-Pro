import assert from "assert";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
    AlbumSheetMutationIntent,
    AlbumSheetMutationReason,
    applyAlbumSheetMutation,
    createAlbumSheetHistory,
    applyAlbumSheetHistoryMutation,
    undoAlbumSheetHistory,
    redoAlbumSheetHistory
} from "../src/project/AlbumSheetSchema";
import {
    AutoFlowStrategy,
    PhotoSourceMode,
    filterPhotosForAutoFlow,
    selectBestTemplate,
    assignPhotosToTemplateSlots,
    generateAutoFlowSpreads
} from "../src/services/PhotoAutoFlowEngine";
import { CullingStatus } from "../src/services/PhotoCullingService";
import AutoFlowModal from "../src/components/AutoFlowModal";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb082Tests() {
    console.info("Starting ALB-082 Smart Auto-Flow Engine tests...");

    // Test 1: filterPhotosForAutoFlow
    {
        const photos = [
            { id: "p1", name: "P1.jpg", culling: { status: CullingStatus.KEEP } },
            { id: "p2", name: "P2.jpg", culling: { status: CullingStatus.REJECT } },
            { id: "p3", name: "P3.jpg", culling: { status: CullingStatus.UNRATED } },
            { id: "p4", name: "P4.jpg", culling: { status: CullingStatus.KEEP } }
        ];

        // KEPT_ONLY
        const kept = filterPhotosForAutoFlow(photos, PhotoSourceMode.KEPT_ONLY);
        check(kept.length === 2, "KEPT_ONLY returns 2 kept photos");
        check(kept[0].id === "p1" && kept[1].id === "p4", "Kept photo IDs match");

        // SELECTED_ONLY
        const selected = filterPhotosForAutoFlow(photos, PhotoSourceMode.SELECTED_ONLY, new Set(["p1", "p3"]));
        check(selected.length === 2, "SELECTED_ONLY returns 2 selected photos");
        check(selected[0].id === "p1" && selected[1].id === "p3", "Selected photo IDs match");

        // ALL_PHOTOS (omits rejected)
        const allNonRejected = filterPhotosForAutoFlow(photos, PhotoSourceMode.ALL_PHOTOS);
        check(allNonRejected.length === 3, "ALL_PHOTOS returns 3 non-rejected photos");
        check(!allNonRejected.some(p => p.id === "p2"), "Rejected photo omitted from ALL_PHOTOS");
    }

    // Test 2: selectBestTemplate
    {
        const templates = [
            { id: "t-1-hero", name: "1-Photo Hero", smartObjects: [{ layerId: 1 }] },
            { id: "t-2-duo-a", name: "2-Photo Duo A", smartObjects: [{ layerId: 1 }, { layerId: 2 }] },
            { id: "t-2-duo-b", name: "2-Photo Duo B", smartObjects: [{ layerId: 1 }, { layerId: 2 }] },
            { id: "t-3-grid", name: "3-Photo Grid", smartObjects: [{ layerId: 1 }, { layerId: 2 }, { layerId: 3 }] },
            { id: "t-4-quad", name: "4-Photo Quad", smartObjects: [{ layerId: 1 }, { layerId: 2 }, { layerId: 3 }, { layerId: 4 }] }
        ];

        // Exact match
        const bestFor3 = selectBestTemplate(templates, 3);
        check(bestFor3.id === "t-3-grid", "selectBestTemplate picks exact 3-slot template");

        // Visual diversity for matching slot counts
        const bestFor2A = selectBestTemplate(templates, 2, null);
        check(bestFor2A.id === "t-2-duo-a", "First pick is t-2-duo-a");
        const bestFor2B = selectBestTemplate(templates, 2, "t-2-duo-a");
        check(bestFor2B.id === "t-2-duo-b", "Alternates to t-2-duo-b to avoid consecutive repetition");

        // Closest match for count without exact template
        const bestFor5 = selectBestTemplate(templates, 5);
        check(bestFor5.id === "t-4-quad", "selectBestTemplate picks closest (4-slot) for 5 items");
    }

    // Test 3: assignPhotosToTemplateSlots & Orientation Matching
    {
        const photos = [
            { id: "p-landscape", metadata: { width: 1920, height: 1080 }, quality: { rankScore: 50 } },
            { id: "p-portrait", metadata: { width: 1080, height: 1920 }, quality: { rankScore: 90 } } // Higher score
        ];

        const template = {
            id: "t-2",
            smartObjects: [
                { layerId: "slot-primary", layerName: "Main Frame" },
                { layerId: "slot-secondary", layerName: "Side Frame" }
            ]
        };

        const assignments = assignPhotosToTemplateSlots(photos, template);
        check(assignments.length === 2, "2 slots assigned");
        
        // p-portrait has higher rankScore (90 vs 50) -> should be assigned to first slot
        check(assignments[0].photoId === "p-portrait", "Higher quality photo placed in first slot");
        check(assignments[0].cropFocus === "top", "Portrait photo assigned top crop focus");
        check(assignments[1].photoId === "p-landscape", "Landscape photo placed in second slot");
        check(assignments[1].cropFocus === "center", "Landscape photo assigned center crop focus");
    }

    // Test 4: generateAutoFlowSpreads (CHRONOLOGICAL_BURST strategy)
    {
        const baseTime = 1700000000000;
        const photos = [
            // Event 1 - Burst 1 (3 rapid photos)
            { id: "p1", dateTaken: baseTime, quality: { rankScore: 70 } },
            { id: "p2", dateTaken: baseTime + 1000, quality: { rankScore: 85 } },
            { id: "p3", dateTaken: baseTime + 2000, quality: { rankScore: 60 } },
            // Event 1 - Regular shot (10 seconds later)
            { id: "p4", dateTaken: baseTime + 12000, quality: { rankScore: 75 } },
            // Event 2 - Separate session (1 hour later)
            { id: "p5", dateTaken: baseTime + 3600000, quality: { rankScore: 80 } },
            { id: "p6", dateTaken: baseTime + 3605000, quality: { rankScore: 78 } }
        ];

        const templates = [
            { id: "t-2-slot", name: "2 Slot", smartObjects: [{ layerId: 1 }, { layerId: 2 }] },
            { id: "t-3-slot", name: "3 Slot", smartObjects: [{ layerId: 1 }, { layerId: 2 }, { layerId: 3 }] }
        ];

        const result = generateAutoFlowSpreads({
            photos,
            templates,
            options: {
                strategy: AutoFlowStrategy.CHRONOLOGICAL_BURST,
                maxPhotosPerSpread: 3,
                eventGapMinutes: 30
            }
        });

        check(result.success === true, "Auto-flow generation succeeded");
        check(result.sheets.length === 3, "Generated 3 spreads total");
        check(result.summary.totalPhotosPlaced === 6, "Placed all 6 photos");
        check(result.summary.eventCount === 2, "Partitioned into 2 chapters/events");

        // Spread 1: Burst 1 (p1, p2, p3) in 3-slot template
        check(result.sheets[0].templateId === "t-3-slot", "Spread 1 uses 3-slot template for 3-burst");
        check(result.sheets[0].slots.length === 3, "Spread 1 has 3 slot assignments");
        check(result.sheets[0].label.includes("Chapter 1"), "Spread 1 labeled Chapter 1");

        // Spread 3: Event 2 (p5, p6) in 2-slot template
        check(result.sheets[2].templateId === "t-2-slot", "Spread 3 uses 2-slot template");
        check(result.sheets[2].slots.length === 2, "Spread 3 has 2 slot assignments");
        check(result.sheets[2].label.includes("Chapter 2"), "Spread 3 labeled Chapter 2");
    }

    // Test 5: generateAutoFlowSpreads (HERO_DYNAMIC strategy)
    {
        const photos = [
            { id: "p-hero", dateTaken: 1000, aiAnalysis: { aggregate: { rankScore: 95 } } }, // Standout hero
            { id: "p-normal-1", dateTaken: 2000, aiAnalysis: { aggregate: { rankScore: 60 } } },
            { id: "p-normal-2", dateTaken: 3000, aiAnalysis: { aggregate: { rankScore: 65 } } }
        ];

        const templates = [
            { id: "t-1-hero", name: "1-Hero", smartObjects: [{ layerId: 1 }] },
            { id: "t-2-slot", name: "2-Slot", smartObjects: [{ layerId: 1 }, { layerId: 2 }] }
        ];

        const result = generateAutoFlowSpreads({
            photos,
            templates,
            options: {
                strategy: AutoFlowStrategy.HERO_DYNAMIC,
                maxPhotosPerSpread: 2
            }
        });

        check(result.success === true, "Hero dynamic generation succeeded");
        check(result.sheets.length === 2, "Generated 2 spreads");
        check(result.sheets[0].templateId === "t-1-hero", "Hero photo received 1-hero template spread");
        check(result.sheets[0].slots[0].photoId === "p-hero", "Hero photo assigned to hero spread");
        check(result.sheets[1].templateId === "t-2-slot", "Remaining photos grouped in 2-slot spread");
    }

    // Test 6: AlbumSheetSchema SET_SHEETS mutation & Undo/Redo
    {
        const initialAlbum = {
            schemaVersion: 1,
            sheets: [
                { id: "old-sheet-1", templateId: "t-1", label: "Old Sheet 1" }
            ]
        };

        const newSheets = [
            { id: "new-spread-1", templateId: "t-1", label: "Auto Spread 1", slots: [{ slotId: 1, photoId: "p1", cropFocus: "center" }] },
            { id: "new-spread-2", templateId: "t-2", label: "Auto Spread 2", slots: [{ slotId: 1, photoId: "p2", cropFocus: "top" }] }
        ];

        let history = createAlbumSheetHistory(initialAlbum);

        const mutationResult = applyAlbumSheetHistoryMutation(history, {
            intent: AlbumSheetMutationIntent.SET_SHEETS,
            sheets: newSheets
        });

        check(mutationResult.accepted === true, "SET_SHEETS mutation accepted");
        check(mutationResult.changed === true, "SET_SHEETS changed history");
        history = mutationResult.history;
        check(history.present.sheets.length === 2, "Present has 2 new sheets");
        check(history.present.sheets[0].id === "new-spread-1", "Sheet 1 is new-spread-1");

        // Undo restores initial album sheets
        const undoResult = undoAlbumSheetHistory(history);
        check(undoResult.changed === true, "Undo changed history");
        history = undoResult.history;
        check(history.present.sheets.length === 1, "Undo restored 1 original sheet");
        check(history.present.sheets[0].id === "old-sheet-1", "Restored old-sheet-1");

        // Redo restores auto-flow sheets
        const redoResult = redoAlbumSheetHistory(history);
        check(redoResult.changed === true, "Redo changed history");
        history = redoResult.history;
        check(history.present.sheets.length === 2, "Redo restored 2 auto-flow sheets");
        check(history.present.sheets[0].id === "new-spread-1", "Redo restored new-spread-1");
    }

    // Test 7: AutoFlowModal Server-Side Rendering
    {
        const photos = [
            { id: "p1", culling: { status: CullingStatus.KEPT } },
            { id: "p2", culling: { status: CullingStatus.KEPT } }
        ];
        const templates = [
            { id: "t1", name: "2-Photo Spread", smartObjects: [{ layerId: 1 }, { layerId: 2 }] }
        ];

        const html = ReactDOMServer.renderToStaticMarkup(
            <AutoFlowModal
                isOpen={true}
                onClose={() => {}}
                photos={photos}
                selectedPhotoIds={new Set(["p1"])}
                templates={templates}
                existingSheetCount={1}
                onApplyAutoFlow={() => {}}
            />
        );

        check(typeof html === "string" && html.length > 0, "AutoFlowModal rendered to HTML");
        check(html.includes("Smart Auto-Flow Engine"), "Contains modal title");
        check(html.includes("Kept Photos"), "Contains Kept Photos source option");
        check(html.includes("Chronological Burst"), "Contains Chronological strategy");
        check(html.includes("Hero Dynamic"), "Contains Hero Dynamic strategy");
        check(html.includes("Replace Album Spreads"), "Contains Replace Spreads button");
        check(html.includes("Append Spreads"), "Contains Append Spreads button");
    }

    console.info(`PASS ALB-082: All assertions passed (${assertions} assertions).`);
}

runAlb082Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
