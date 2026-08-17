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
    redoAlbumSheetHistory,
    inspectAlbum
} from "../src/project/AlbumSheetSchema";
import {
    createAlbumSheetRenderRequest
} from "../src/project/AlbumSheetRenderBridge";
import SpreadCanvas from "../src/components/SpreadCanvas";
import SheetStoryboardStrip from "../src/components/SheetStoryboardStrip";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb081Tests() {
    console.info("Starting ALB-081 Manual Designer Workflow tests...");

    const initialAlbum = {
        schemaVersion: 1,
        sheets: [
            { id: "sheet-1", templateId: "template-grid-3", label: "Front Spread" },
            { id: "sheet-2", templateId: "template-hero-1", label: "Hero Spread" }
        ]
    };

    // Test 1: ASSIGN_SLOT mutation
    {
        const mutation = {
            intent: AlbumSheetMutationIntent.ASSIGN_SLOT,
            sheetId: "sheet-1",
            slotId: 101,
            photoId: "photo-uuid-1",
            cropFocus: "top"
        };
        const result = applyAlbumSheetMutation(initialAlbum, mutation);
        check(result.accepted === true, "ASSIGN_SLOT is accepted");
        check(result.changed === true, "ASSIGN_SLOT changed album");
        
        const targetSheet = result.album.sheets.find(s => s.id === "sheet-1");
        check(Array.isArray(targetSheet.slots), "Sheet has slots array");
        check(targetSheet.slots.length === 1, "Sheet has 1 slot assigned");
        check(targetSheet.slots[0].slotId === 101, "Slot ID is 101");
        check(targetSheet.slots[0].photoId === "photo-uuid-1", "Photo ID is photo-uuid-1");
        check(targetSheet.slots[0].cropFocus === "top", "Crop focus is top");

        // Reassigning same slot with new photo replaces assignment
        const reassignResult = applyAlbumSheetMutation(result.album, {
            intent: AlbumSheetMutationIntent.ASSIGN_SLOT,
            sheetId: "sheet-1",
            slotId: 101,
            photoId: "photo-uuid-2",
            cropFocus: "center"
        });
        check(reassignResult.accepted === true, "Reassignment accepted");
        const reassignSheet = reassignResult.album.sheets.find(s => s.id === "sheet-1");
        check(reassignSheet.slots.length === 1, "Slot length still 1");
        check(reassignSheet.slots[0].photoId === "photo-uuid-2", "Photo updated to photo-uuid-2");
        check(reassignSheet.slots[0].cropFocus === "center", "Crop updated to center");
    }

    // Test 2: UNASSIGN_SLOT mutation
    {
        const albumWithSlots = {
            schemaVersion: 1,
            sheets: [
                {
                    id: "sheet-1",
                    templateId: "template-grid-3",
                    slots: [
                        { slotId: 101, photoId: "photo-1", cropFocus: "center" },
                        { slotId: 102, photoId: "photo-2", cropFocus: "bottom" }
                    ]
                }
            ]
        };

        const unassignResult = applyAlbumSheetMutation(albumWithSlots, {
            intent: AlbumSheetMutationIntent.UNASSIGN_SLOT,
            sheetId: "sheet-1",
            slotId: 101
        });
        check(unassignResult.accepted === true, "UNASSIGN_SLOT accepted");
        check(unassignResult.changed === true, "UNASSIGN_SLOT changed");
        const sheet = unassignResult.album.sheets[0];
        check(sheet.slots.length === 1, "Remaining slots is 1");
        check(sheet.slots[0].slotId === 102, "Remaining slot is 102");

        // Unassigning non-existent slot returns unchanged
        const noopResult = applyAlbumSheetMutation(unassignResult.album, {
            intent: AlbumSheetMutationIntent.UNASSIGN_SLOT,
            sheetId: "sheet-1",
            slotId: 999
        });
        check(noopResult.changed === false, "Unassigning missing slot is unchanged");
    }

    // Test 3: SWAP_SLOTS mutation
    {
        const albumWithSlots = {
            schemaVersion: 1,
            sheets: [
                {
                    id: "sheet-1",
                    templateId: "template-grid-3",
                    slots: [
                        { slotId: "slot-A", photoId: "photo-1", cropFocus: "left" },
                        { slotId: "slot-B", photoId: "photo-2", cropFocus: "right" }
                    ]
                }
            ]
        };

        const swapResult = applyAlbumSheetMutation(albumWithSlots, {
            intent: AlbumSheetMutationIntent.SWAP_SLOTS,
            sheetId: "sheet-1",
            slotIdA: "slot-A",
            slotIdB: "slot-B"
        });
        check(swapResult.accepted === true, "SWAP_SLOTS accepted");
        check(swapResult.changed === true, "SWAP_SLOTS changed");
        const sheet = swapResult.album.sheets[0];
        const newSlotA = sheet.slots.find(s => s.slotId === "slot-A");
        const newSlotB = sheet.slots.find(s => s.slotId === "slot-B");
        check(newSlotA.photoId === "photo-2", "Slot A now has photo-2");
        check(newSlotA.cropFocus === "right", "Slot A preserved photo-2's cropFocus");
        check(newSlotB.photoId === "photo-1", "Slot B now has photo-1");
        check(newSlotB.cropFocus === "left", "Slot B preserved photo-1's cropFocus");
    }

    // Test 4: SET_SLOT_CROP mutation
    {
        const albumWithSlots = {
            schemaVersion: 1,
            sheets: [
                {
                    id: "sheet-1",
                    templateId: "template-grid-3",
                    slots: [{ slotId: 101, photoId: "photo-1", cropFocus: "center" }]
                }
            ]
        };

        const cropResult = applyAlbumSheetMutation(albumWithSlots, {
            intent: AlbumSheetMutationIntent.SET_SLOT_CROP,
            sheetId: "sheet-1",
            slotId: 101,
            cropFocus: "bottom"
        });
        check(cropResult.accepted === true, "SET_SLOT_CROP accepted");
        check(cropResult.changed === true, "SET_SLOT_CROP changed");
        check(cropResult.album.sheets[0].slots[0].cropFocus === "bottom", "Crop focus updated to bottom");

        // Same crop returns unchanged
        const noopCrop = applyAlbumSheetMutation(cropResult.album, {
            intent: AlbumSheetMutationIntent.SET_SLOT_CROP,
            sheetId: "sheet-1",
            slotId: 101,
            cropFocus: "bottom"
        });
        check(noopCrop.changed === false, "Same crop focus is unchanged");
    }

    // Test 5: Undo and Redo for slot mutations
    {
        let history = createAlbumSheetHistory(initialAlbum);
        check(history != null, "History initialized");

        // Step 1: Assign slot
        const step1 = applyAlbumSheetHistoryMutation(history, {
            intent: AlbumSheetMutationIntent.ASSIGN_SLOT,
            sheetId: "sheet-1",
            slotId: "slot-1",
            photoId: "photo-100"
        });
        check(step1.accepted === true && step1.changed === true, "History step 1 applied");
        history = step1.history;
        check(history.present.sheets[0].slots?.length === 1, "History present has 1 slot");

        // Step 2: Undo
        const undoResult = undoAlbumSheetHistory(history);
        check(undoResult.changed === true, "Undo changed history");
        history = undoResult.history;
        check(history.present.sheets[0].slots === undefined || history.present.sheets[0].slots?.length === 0, "Undo restored empty slots");

        // Step 3: Redo
        const redoResult = redoAlbumSheetHistory(history);
        check(redoResult.changed === true, "Redo changed history");
        history = redoResult.history;
        check(history.present.sheets[0].slots[0].photoId === "photo-100", "Redo restored assigned photo-100");
    }

    // Test 6: createAlbumSheetRenderRequest with assigned slots
    {
        const albumWithSlots = {
            schemaVersion: 1,
            sheets: [
                {
                    id: "sheet-1",
                    templateId: "template-1",
                    slots: [
                        { slotId: 101, photoId: "explicit-photo-A", cropFocus: "center" },
                        { slotId: 102, photoId: "explicit-photo-B", cropFocus: "top" }
                    ]
                }
            ]
        };

        const registry = [
            {
                id: "template-1",
                name: "Template 1",
                fileReference: "Template1.psd",
                validationSchemaVersion: 1,
                validationState: "READY"
            }
        ];

        const requestResult = createAlbumSheetRenderRequest({
            projectId: "project-1",
            album: albumWithSlots,
            registry,
            sheetId: "sheet-1",
            selectedPhotoIds: ["fallback-photo-1", "fallback-photo-2"]
        });

        check(requestResult.accepted === true, "Render request accepted");
        check(requestResult.request.sheet.slots.length === 2, "Request carries 2 slots");
        check(requestResult.request.selectedPhotoIds[0] === "explicit-photo-A", "Request uses explicit slot photo A");
        check(requestResult.request.selectedPhotoIds[1] === "explicit-photo-B", "Request uses explicit slot photo B");
    }

    // Test 7: SpreadCanvas Component Server Rendering
    {
        const sheet = {
            id: "sheet-1",
            label: "Intro Spread",
            templateId: "template-1",
            slots: [
                { slotId: 101, photoId: "p1", cropFocus: "center" }
            ]
        };
        const template = {
            id: "template-1",
            name: "Template 1",
            smartObjects: [
                { layerId: 101, layerName: "Left Slot" },
                { layerId: 102, layerName: "Right Slot" }
            ]
        };
        const photos = [
            { id: "p1", name: "Wedding_01.jpg" }
        ];

        const html = ReactDOMServer.renderToStaticMarkup(
            <SpreadCanvas
                sheet={sheet}
                template={template}
                photos={photos}
                selectedPhoto={photos[0]}
                onAssignSlot={() => {}}
                onUnassignSlot={() => {}}
                onSwapSlots={() => {}}
                onSetSlotCrop={() => {}}
                onRenderSheet={() => {}}
            />
        );

        check(typeof html === "string" && html.length > 0, "SpreadCanvas rendered to HTML");
        check(html.includes("Intro Spread"), "Contains sheet label");
        check(html.includes("Left Slot"), "Contains slot name");
        check(html.includes("Wedding_01.jpg"), "Contains assigned photo name");
        check(html.includes("Render Spread"), "Contains Render Spread button");
    }

    // Test 8: SheetStoryboardStrip Component Server Rendering
    {
        const sheets = [
            {
                id: "sheet-1",
                label: "Cover Spread",
                templateId: "template-1",
                slots: [{ slotId: 101, photoId: "p1" }]
            },
            {
                id: "sheet-2",
                label: "Ceremony Spread",
                templateId: "template-1",
                slots: []
            }
        ];
        const templates = [
            {
                id: "template-1",
                name: "2-Grid Template",
                smartObjects: [{ layerId: 101 }, { layerId: 102 }]
            }
        ];

        const html = ReactDOMServer.renderToStaticMarkup(
            <SheetStoryboardStrip
                sheets={sheets}
                selectedSheetId="sheet-1"
                templates={templates}
                onSelectSheet={() => {}}
                onMoveSheet={() => {}}
                onDuplicateSheet={() => {}}
                onRemoveSheet={() => {}}
                onAddSheet={() => {}}
            />
        );

        check(typeof html === "string" && html.length > 0, "SheetStoryboardStrip rendered to HTML");
        check(html.includes("Sheet Storyboard"), "Contains Storyboard title");
        check(html.includes("Cover Spread"), "Contains sheet 1 label");
        check(html.includes("Ceremony Spread"), "Contains sheet 2 label");
        check(html.includes("1/2"), "Contains slot fill ratio badge");
        check(html.includes("Add Sheet"), "Contains Add Sheet button");
    }

    console.info(`PASS ALB-081: All assertions passed (${assertions} assertions).`);
}

runAlb081Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
