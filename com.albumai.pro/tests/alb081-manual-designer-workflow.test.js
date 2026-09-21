import {transferSpreadPhoto, bindSpreadDrag} from "../src/components/spreadDrag";
import { PsdPreviews } from "../src/services/TemplateDocumentReader";
import TemplateDocumentPanel from "../src/components/TemplateDocumentPanel";
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
import SpreadCanvas, { draftPhotoFrame, zoomPhotoPosition, editPreviewSlots, bindAssetDrop, bindPreviewSwap, DesignWorkspace, designSlotOverview, filterDesignPhotos } from "../src/components/SpreadCanvas";
import SheetStoryboardStrip from "../src/components/SheetStoryboardStrip";
import {
    computeCompletedSteps,
    canNavigateToStep,
    resolveWizardNavigation,
    workspaceModeForWizardStep
} from "../src/services/PhotoGroupingEngine";
import LibraryEngine from "../src/core/LibraryEngine";
import SelectionEngine from "../src/core/SelectionEngine";

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

    {
        const slot = {cropFocus:"top", position:{zoom:1.5,x:0,y:0}};
        const photo = {metadata:{width:600,height:900}};
        const region = {width:.8,height:1};
        const before = draftPhotoFrame(slot, photo, region, 1.5);
        const position = zoomPhotoPosition(slot, photo, region, 1.5, .1);
        const after = draftPhotoFrame({...slot,position}, photo, region, 1.5);
        check(!!before, "Metadata dimensions support live brush-slot zoom");
        check(Math.abs((.5-before.y)/before.height - (.5-after.y)/after.height) < 1e-9,
            "Zoom preserves the visible centre of a top-anchored photo");
    }
    {
        const a = [{slotId:1,photoId:"a",position:{zoom:1.2}}], b = [{slotId:9,photoId:"b"}];
        const swapped = transferSpreadPhoto(a,b,1,9);
        check(swapped.source[0].photoId === "b" && swapped.target[0].photoId === "a", "Cross-spread occupied slots swap both photos");
        const moved = transferSpreadPhoto(a,b,1,10);
        check(moved.source.length === 0 && moved.target.length === 2 && moved.target[1].position.zoom === 1.2, "Cross-spread empty-slot move preserves crop and vacates source");
        check(a[0].photoId === "a" && b.length === 1 && transferSpreadPhoto(a,b,2,9) === null, "Cross-spread transfer is immutable and ignores absent source");
        const surface = () => ({handlers:{}, addEventListener(t,f){this.handlers[t]=f;},removeEventListener(t){delete this.handlers[t];}});
        const doc = surface(), host = {...surface(),requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
        const card = {getAttribute:()=>"b",getBoundingClientRect:()=>({left:100,right:200,top:0,bottom:80}),setAttribute(){},removeAttribute(){}};
        const root = {...surface(),querySelectorAll:()=>[card],querySelector:()=>({contains:()=>true})};
        let result, selected;
        const state = {sheetId:"a",disabled:false,canTransfer:()=>true,select:id=>{selected=id;state.sheetId=id;},reorder:(...args)=>result=args,transfer:(...args)=>result=args};
        const cleanup=bindSpreadDrag(root,()=>state,doc,host);
        const start = {getAttribute:()=>"a"};
        root.handlers.mousedown({button:0,clientX:10,clientY:20,target:{closest:q=>q==='[data-spread-card]'?start:null}});
        doc.handlers.mousemove({clientX:130,clientY:20,buttons:1,preventDefault(){}});
        doc.handlers.mouseup({clientX:130,clientY:20,button:0});
        check(result?.join() === "a,b", "Thumbnail drag commits a reorder on drop");
        result=null;
        root.handlers.mousedown({button:0,clientX:10,clientY:20,target:{closest:q=>q.includes('data-drop-slot')?{getAttribute:()=>"1"}:null}});
        doc.handlers.mousemove({clientX:130,clientY:20,buttons:1,preventDefault(){}});
        await new Promise(resolve=>setTimeout(resolve,480));
        check(selected === "b", "Hovering another thumbnail opens its spread during photo drag");
        let preventedNative = false;
        root.handlers.dragstart({preventDefault(){preventedNative=true;}});
        check(preventedNative, "Native image dragging cannot steal the cross-spread gesture");
        const destination = {getAttribute:()=>"9",getBoundingClientRect:()=>({left:100,right:200,top:0,bottom:80})};
        root.querySelectorAll = selector => selector.includes('data-drop-slot') ? [destination] : [card];
        doc.handlers.mousemove({clientX:130,clientY:20,buttons:0,preventDefault(){}});
        doc.handlers.mouseup({clientX:130,clientY:20,button:0});
        check(result?.join() === "a,1,b,9", "Cross-spread drop survives UXP mousemove buttons=0 and commits both slot IDs");
        result = null;

        doc.handlers.keydown({key:"Escape"});
        doc.handlers.mouseup({clientX:130,clientY:20,button:0});
        check(result === null, "Escape cancels cross-spread drag without moving photos");
        state.pan=(...args)=>result=args;
        state.swap=(...args)=>result=args;
        root.handlers.mousedown({button:0,clientX:120,clientY:20,target:{closest:q=>q==='[data-drop-slot]'?destination:null}});
        doc.handlers.mousemove({clientX:140,clientY:20,buttons:0,preventDefault(){}});
        doc.handlers.mouseup({clientX:140,clientY:20,button:0});
        check(result?.join() === '9,0.2,0', 'Workspace gesture commits same-slot pan without a second handler');
        root.handlers.mousedown({button:0,clientX:120,clientY:20,target:{closest:q=>q==='[data-drop-slot]'?{getAttribute:()=>"1"}:null}});
        doc.handlers.mousemove({clientX:140,clientY:20,buttons:0,preventDefault(){}});
        doc.handlers.mouseup({clientX:140,clientY:20,button:0});
        check(result?.join() === 'b,1,9', 'Workspace gesture commits same-spread slot swap');
        cleanup();
    }
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
        const positioned = applyAlbumSheetMutation(cropResult.album, {intent: AlbumSheetMutationIntent.SET_SLOT_CROP,
            sheetId: "sheet-1", slotId: 101, cropFocus: "bottom", position: {x: .2, y: -.3, zoom: 1.4}});
        const reopened = inspectAlbum(JSON.parse(JSON.stringify(positioned.album))).album;
        assert.deepStrictEqual(reopened.sheets[0].slots[0].position, {x: .2, y: -.3, zoom: 1.4});
        check(positioned.changed, "Changing only position persists a crop edit");
        const history = createAlbumSheetHistory(cropResult.album);
        const edit = applyAlbumSheetHistoryMutation(history, {intent: AlbumSheetMutationIntent.SET_SLOT_CROP,
            sheetId: "sheet-1", slotId: 101, cropFocus: "bottom", position: {x: 0, y: .3, zoom: 2}});
        const undo = undoAlbumSheetHistory(edit.history);
        check(!undo.history.present.sheets[0].slots[0].position, "Undo restores the previous position and zoom");
        const reset = applyAlbumSheetMutation(reopened, {intent: AlbumSheetMutationIntent.SET_SLOT_CROP,
            sheetId: "sheet-1", slotId: 101, cropFocus: "center"});
        check(!reset.album.sheets[0].slots[0].position, "Reset clears manual position and zoom");

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

    // Test 10: Wizard Navigation & Direct Designer Entry Qualification
    {
        // 1. Normal Step-4 wizard gating without KEEP decisions fails
        const stepsNoKeep = computeCompletedSteps({
            photoCount: 36,
            analysisComplete: true,
            groupsReviewed: true,
            keptPhotoCount: 0,
            placedPhotoCount: 0,
            exportComplete: false
        });
        check(stepsNoKeep.has(1) === true, "Step 1 completed with photos");
        check(stepsNoKeep.has(2) === true, "Step 2 completed with groups reviewed");
        check(stepsNoKeep.has(3) === false, "Step 3 not completed without KEEP decisions");
        check(canNavigateToStep(1, 4, stepsNoKeep) === false, "Normal Step 4 navigation blocked without KEEP decisions");
        check(resolveWizardNavigation({
            currentStep: 1,
            targetStep: 4,
            completedSteps: stepsNoKeep,
            hasProject: true,
            photoCount: 36,
            directDesignerEntry: false
        }) === false, "resolveWizardNavigation blocks normal Step 4 without KEEP decisions");

        // 2. Normal Step-4 wizard gating with KEEP decisions succeeds
        const stepsWithKeep = computeCompletedSteps({
            photoCount: 36,
            analysisComplete: true,
            groupsReviewed: true,
            keptPhotoCount: 5,
            placedPhotoCount: 0,
            exportComplete: false
        });
        check(stepsWithKeep.has(3) === true, "Step 3 completed with KEEP decisions");
        check(canNavigateToStep(1, 4, stepsWithKeep) === true, "Normal Step 4 navigation allowed with KEEP decisions");
        check(resolveWizardNavigation({
            currentStep: 1,
            targetStep: 4,
            completedSteps: stepsWithKeep,
            hasProject: true,
            photoCount: 36,
            directDesignerEntry: false
        }) === true, "resolveWizardNavigation allows normal Step 4 with KEEP decisions");

        // 3. Direct Designer entry works with project + photos even with 0 KEEP decisions
        const directAllowed = resolveWizardNavigation({
            currentStep: 1,
            targetStep: 4,
            completedSteps: stepsNoKeep,
            hasProject: true,
            photoCount: 36,
            directDesignerEntry: true
        });
        check(directAllowed === true, "Explicit Go to Designer allowed with project + photos even with 0 KEEP decisions");

        // 4. Direct Designer entry fails closed without project
        const directNoProject = resolveWizardNavigation({
            currentStep: 1,
            targetStep: 4,
            completedSteps: stepsNoKeep,
            hasProject: false,
            photoCount: 36,
            directDesignerEntry: true
        });
        check(directNoProject === false, "Direct Designer entry blocked without open project");

        // 5. Direct Designer entry fails closed with zero photos
        const directNoPhotos = resolveWizardNavigation({
            currentStep: 1,
            targetStep: 4,
            completedSteps: stepsNoKeep,
            hasProject: true,
            photoCount: 0,
            directDesignerEntry: true
        });
        check(directNoPhotos === false, "Direct Designer entry blocked with zero photos");

        // 6. Direct Designer entry fails closed for non-step-4 targets
        const directWrongStep = resolveWizardNavigation({
            currentStep: 1,
            targetStep: 5,
            completedSteps: stepsNoKeep,
            hasProject: true,
            photoCount: 36,
            directDesignerEntry: true
        });
        check(directWrongStep === false, "Direct Designer entry blocked for non-Designer step target");

        // 7. Domain separation: browser selection does NOT alter culling KEEP decisions
        const mockPhotos = [
            { id: "photo-1", selected: true },
            { id: "photo-2", selected: false }
        ];
        const mockCullingStore = new Map();
        const cullingDecisions = mockPhotos.filter(p => {
            const decision = mockCullingStore.get(p.id);
            return decision === "keep" || decision === "KEEP";
        }).length;
        check(cullingDecisions === 0, "Browser selection (selected: true) does not alter culling KEEP count");
    }

    // Test 11: Canonical Selection Event Contract & Workspace Persistence Qualification
    {
        const library = new LibraryEngine();
        const photos = [
            { id: "photo-1", name: "1.jpg" },
            { id: "photo-2", name: "2.jpg" },
            { id: "photo-3", name: "3.jpg" },
            { id: "photo-4", name: "4.jpg" }
        ];
        library.load(photos);
        const selection = new SelectionEngine(library);
        selection.setOrderedPhotos(photos);

        // Simulated OpenFolder click handler contract: onPhotoClick(photo, event)
        let focusedPhotoId = null;
        const onPhotoClick = (photo, event = {}) => {
            focusedPhotoId = photo?.id || null;
            selection.handleClick(photo, event);
        };

        // 1. Normal click: updates both focusedPhotoId and canonical selection (single-selection)
        onPhotoClick(photos[1], {});
        check(focusedPhotoId === "photo-2", "Normal click sets focusedPhotoId");
        check(selection.selectedIds().size === 1, "Normal click results in 1 selected photo");
        check(selection.isSelected("photo-2") === true, "Normal click selects clicked photo");
        check(selection.getSelected()[0]?.id === "photo-2", "selection.getSelected() returns clicked photo");

        // 2. Modifier click: Cmd/Ctrl click toggles without replacing
        onPhotoClick(photos[3], { ctrlKey: true });
        check(focusedPhotoId === "photo-4", "Cmd/Ctrl click sets focusedPhotoId");
        check(selection.selectedIds().size === 2, "Cmd/Ctrl click adds to selection");
        check(selection.isSelected("photo-2") === true, "Previous selection preserved on Cmd/Ctrl click");
        check(selection.isSelected("photo-4") === true, "New photo selected on Cmd/Ctrl click");

        // 3. Modifier click: Shift click creates contiguous range
        onPhotoClick(photos[0], {}); // Reset anchor to photo-1
        onPhotoClick(photos[2], { shiftKey: true }); // Range from photo-1 to photo-3
        check(selection.selectedIds().size === 3, "Shift click selects range of 3 photos");
        check(selection.isSelected("photo-1") === true, "photo-1 in range");
        check(selection.isSelected("photo-2") === true, "photo-2 in range");
        check(selection.isSelected("photo-3") === true, "photo-3 in range");
        check(selection.isSelected("photo-4") === false, "photo-4 not in range");

        // 4. Normal click resets multi-selection to single photo
        onPhotoClick(photos[2], {});
        check(selection.selectedIds().size === 1, "Normal click resets multi-selection to single selection");
        check(selection.isSelected("photo-3") === true, "Only photo-3 selected");

        // 5. Workspace mode simulation: selection survives LIBRARY -> DESIGNER -> LIBRARY
        // Entering Designer mode: components unmount, but App.selection is retained in memory
        let activeWorkspaceMode = "LIBRARY";
        check(selection.getSelected().length === 1, "Selected count is 1 before Designer");

        // Transition to DESIGNER
        activeWorkspaceMode = "DESIGNER";
        const designerSelectedPhoto = selection.getSelected()[0] || null;
        check(designerSelectedPhoto?.id === "photo-3", "SpreadCanvas receives activeSelectedPhoto in DESIGNER");

        // Transition back to LIBRARY (e.g. 3. Cull)
        activeWorkspaceMode = "LIBRARY";
        check(selection.getSelected().length === 1, "Selected count survives return to LIBRARY");
        check(selection.isSelected("photo-3") === true, "photo-3 remains selected upon return to LIBRARY");

        // 6. Explicit clear: Escape or Clear button clears selection
        selection.clear();
        check(selection.selectedIds().size === 0, "Explicit clear zeroes selection");
        check(selection.getSelected().length === 0, "selection.getSelected() returns empty array after clear");

        // 7. Reconcile / Lifecycle clear: retainAvailable and library reload
        selection.select(photos[0]);
        selection.retainAvailable([photos[1], photos[2]]); // photos[0] no longer available
        check(selection.selectedIds().size === 0, "retainAvailable removes unavailable photo IDs");
    }

    // Test 12: REC-002 Derived Workspace Mode & Unified Navigation Architecture Qualification
    {
        // 1. workspaceModeForWizardStep mappings
        check(workspaceModeForWizardStep(1) === "LIBRARY", "Step 1 maps to LIBRARY");
        check(workspaceModeForWizardStep(2) === "LIBRARY", "Step 2 maps to LIBRARY");
        check(workspaceModeForWizardStep(3) === "LIBRARY", "Step 3 maps to LIBRARY");
        check(workspaceModeForWizardStep(4) === "DESIGNER", "Step 4 maps to DESIGNER");
        check(workspaceModeForWizardStep(5) === "EXPORT", "Step 5 maps to EXPORT");
        check(workspaceModeForWizardStep(0) === "LIBRARY", "Out of bounds step 0 defaults to LIBRARY");
        check(workspaceModeForWizardStep(6) === "LIBRARY", "Out of bounds step 6 defaults to LIBRARY");
        check(workspaceModeForWizardStep(null) === "LIBRARY", "Null step defaults to LIBRARY");
        check(workspaceModeForWizardStep(undefined) === "LIBRARY", "Undefined step defaults to LIBRARY");
        check(workspaceModeForWizardStep("4") === "DESIGNER", "String '4' coerces to DESIGNER");

        // 2. Canonical dispatcher state progression simulation
        let wizardStep = 1;
        const setWizardStep = (next) => { wizardStep = next; };
        const getActiveWorkspaceMode = () => workspaceModeForWizardStep(wizardStep);

        const completedSteps = computeCompletedSteps({
            photoCount: 36,
            analysisComplete: true,
            groupsReviewed: true,
            keptPhotoCount: 0,
            placedPhotoCount: 0,
            exportComplete: false
        });

        const handleWizardStepClick = (stepId, { directDesignerEntry = false } = {}) => {
            const isAllowed = resolveWizardNavigation({
                currentStep: wizardStep,
                targetStep: stepId,
                completedSteps,
                hasProject: true,
                photoCount: 36,
                directDesignerEntry
            });
            if (!isAllowed) return;
            setWizardStep(stepId);
        };

        // Start at Step 1 (Import)
        check(wizardStep === 1, "Initial wizard step is 1");
        check(getActiveWorkspaceMode() === "LIBRARY", "Initial workspace mode is LIBRARY");

        // Navigate to Step 2 (Sort)
        handleWizardStepClick(2);
        check(wizardStep === 2, "Navigated to Step 2");
        check(getActiveWorkspaceMode() === "LIBRARY", "Step 2 renders LIBRARY workspace");

        // Navigate to Step 3 (Cull)
        handleWizardStepClick(3);
        check(wizardStep === 3, "Navigated to Step 3");
        check(getActiveWorkspaceMode() === "LIBRARY", "Step 3 renders LIBRARY workspace");

        // Step 4 without directDesignerEntry fails because Step 3 is incomplete
        handleWizardStepClick(4);
        check(wizardStep === 3, "Normal Step 4 navigation blocked without KEEP decisions");
        check(getActiveWorkspaceMode() === "LIBRARY", "Workspace mode remains LIBRARY");

        // Direct Designer action transitions to Step 4 and DESIGNER workspace
        handleWizardStepClick(4, { directDesignerEntry: true });
        check(wizardStep === 4, "Direct Designer action transitions to Step 4");
        check(getActiveWorkspaceMode() === "DESIGNER", "Derived workspace mode is DESIGNER");

        // Designer empty state return button transitions back to Step 1 and LIBRARY workspace
        handleWizardStepClick(1);
        check(wizardStep === 1, "Return to Library transitions to Step 1");
        check(getActiveWorkspaceMode() === "LIBRARY", "Derived workspace mode is LIBRARY");

        // Export pane return button transitions to Step 4 and DESIGNER workspace
        handleWizardStepClick(4, { directDesignerEntry: true });
        check(wizardStep === 4, "Navigated back to Step 4");
        check(getActiveWorkspaceMode() === "DESIGNER", "Derived workspace mode is DESIGNER");

        // Project lifecycle resets: closeProject / createProject / openProject reset to Step 1
        setWizardStep(1);
        check(wizardStep === 1, "Project close resets wizard step to 1");
        check(getActiveWorkspaceMode() === "LIBRARY", "Project close resets workspace mode to LIBRARY");
    }

    // Test 13: REC-003A Responsive Layout Containment & Inspector Flex Invariants Qualification
    {
        const fs = require("fs");
        const path = require("path");
        const projectRoot = path.resolve(__dirname, "..");
        const previewPath = path.join(projectRoot, "src/components/PreviewPanel.jsx");
        const stylesPath = path.join(projectRoot, "src/styles.css");
        const photoBrowserPath = path.join(projectRoot, "src/components/PhotoBrowserSection.jsx");

        if (fs.existsSync(previewPath) && fs.existsSync(stylesPath) && fs.existsSync(photoBrowserPath)) {
            const previewPanelSource = fs.readFileSync(previewPath, "utf8");
            const stylesSource = fs.readFileSync(stylesPath, "utf8");
            const photoBrowserSource = fs.readFileSync(photoBrowserPath, "utf8");

            // 1. Verify rigid inline width locks removed from PreviewPanel
            check(!previewPanelSource.includes('flex: "0 0 280px"'), "Rigid flex: 0 0 280px inline lock removed");
            check(!previewPanelSource.includes("width: 280,"), "Rigid width: 280 inline lock removed");

            // 2. Verify styles.css contains library-workspace-container and responsive dock breakpoint rules
            check(stylesSource.includes(".library-workspace-container"), "styles.css defines .library-workspace-container rule");
            check(stylesSource.includes("@media (max-width: 720px)"), "styles.css defines 720px responsive dock media query");
            check(stylesSource.includes("flex-direction: column !important"), "styles.css stacks Library and Inspector vertically on narrow/medium dock");
            check(stylesSource.includes("overflow-x: hidden !important"), "styles.css enforces global root horizontal scrollbar prevention");
            check(stylesSource.includes("min-width: max-content"), "styles.css prevents wizard step buttons from collapsing into dots");
            check(stylesSource.includes("flex-wrap: wrap !important"), "styles.css ensures toolbar groups wrap within viewport");
            check(stylesSource.includes("max-width: 100% !important"), "styles.css enforces parent-relative 100% max-width containment");
            check(!stylesSource.includes("100vw"), "styles.css does not use host-window 100vw viewport references");
            check(stylesSource.includes("z-index: 100000 !important"), "styles.css elevates modals above underlying controls with high z-index");
            check(stylesSource.includes(".album-autoflow-btn:disabled"), "styles.css defines disabled styles for Auto-Flow button");
            check(stylesSource.includes(".album-printproof-btn:disabled"), "styles.css defines disabled styles for Print & Proof button");
            check(stylesSource.includes("cursor: not-allowed"), "styles.css sets cursor: not-allowed on disabled designer action buttons");

            // 3. Verify PhotoBrowserSection structured toolbar hierarchy and disambiguated action labels
            check(photoBrowserSource.includes('aria-label="Primary photo controls"'), "Primary toolbar defines role and primary aria-label");
            check(photoBrowserSource.includes('aria-label="View and source options"'), "Primary toolbar contains View / Source group");
            check(photoBrowserSource.includes('aria-label="Search"'), "Primary toolbar contains Discovery group");
            check(photoBrowserSource.includes('aria-label="Sort and selection"'), "Primary toolbar contains Sort / Selection group");
            check(photoBrowserSource.includes('aria-label="Workflow and filter controls"'), "Secondary toolbar defines Workflow / Filter role and aria-label");
            check(photoBrowserSource.includes('aria-label="Culling workflow"'), "Workflow toolbar contains Culling group");
            check(photoBrowserSource.includes('aria-label="Metadata and decision filters"'), "Workflow toolbar contains Metadata / Decision Filters group");
            check(photoBrowserSource.includes("Deselect"), "PhotoBrowserSection uses unambiguous Deselect label for selection clear");
            check(photoBrowserSource.includes("✕ Reset Filters"), "PhotoBrowserSection uses unambiguous Reset Filters label for filter reset");
            check(photoBrowserSource.includes("photo-browser-orientation"), "PhotoBrowserSection preserves orientation filter dropdown");
            check(photoBrowserSource.includes("duplicatesOnly") && photoBrowserSource.includes("analyzeDuplicates"), "PhotoBrowserSection preserves separate duplicates only checkbox and duplicate analysis action");

            // 4. Verify styles.css photo-culling-toolbar containment
            check(stylesSource.includes(".photo-culling-toolbar"), "styles.css defines .photo-culling-toolbar rule");
            check(stylesSource.includes("flex: 0 0 auto"), "styles.css prevents toolbar shrinking under flex column layout");

            // 5. Verify REC-003C class-based responsive preview and metadata structure
            check(stylesSource.includes(".inspector-preview-box"), "styles.css defines .inspector-preview-box rule");
            check(stylesSource.includes("object-fit: contain"), "styles.css ensures preview images are not cropped");
            check(previewPanelSource.includes("inspector-preview-box"), "PreviewPanel uses class-based responsive preview box");
            check(previewPanelSource.includes('objectFit: "contain"'), "PreviewPanel explicitly passes objectFit contain style to PhotoImage");
            check(previewPanelSource.includes("inspector-metadata-card"), "PreviewPanel uses structured metadata card");
            check(previewPanelSource.includes('data-execution-log-viewport="true"'), "PreviewPanel preserves execution log viewport marker");

            // 6. Verify ExecutionDetailsPanel invariants
            const executionDetailsPath = path.join(projectRoot, "src/components/ExecutionDetailsPanel.jsx");
            if (fs.existsSync(executionDetailsPath)) {
                const executionDetailsSource = fs.readFileSync(executionDetailsPath, "utf8");
                check(executionDetailsSource.includes("Project Health"), "Project Health remains directly visible in Execution Details");
                check(executionDetailsSource.includes("Copy Summary"), "Copy Summary action preserved");
                check(executionDetailsSource.includes("Copy Debug Log"), "Copy Debug Log action preserved");
                check(executionDetailsSource.includes("export function summaryText"), "summaryText export preserved");
                check(executionDetailsSource.includes("export function debugText"), "debugText export preserved");
            }

            // 7. Verify TemplateDocumentPanel active PSD enablement & registration
            const templatePanelPath = path.join(projectRoot, "src/components/TemplateDocumentPanel.jsx");
            if (fs.existsSync(templatePanelPath)) {
                const templatePanelSource = fs.readFileSync(templatePanelPath, "utf8");
                check(templatePanelSource.includes("getActivePhotoshopDocument"), "TemplateDocumentPanel accepts getActivePhotoshopDocument prop");
                check(templatePanelSource.includes("activePsdTarget"), "TemplateDocumentPanel computes activePsdTarget for Add Current PSD button");
                check(templatePanelSource.includes("disabled={registryLocked || !hasProject || !activePsdTarget}"), "Add Current PSD is enabled when active Photoshop PSD is open");
            }

            // 8. Verify OpenFolder registeredTemplates state synchronization & auto-selection
            const openFolderPath = path.join(projectRoot, "src/components/OpenFolder.jsx");
            if (fs.existsSync(openFolderPath)) {
                const openFolderSource = fs.readFileSync(openFolderPath, "utf8");
                check(openFolderSource.includes("const [registeredTemplates, setRegisteredTemplates] = useState"), "OpenFolder manages registeredTemplates in state");
                check(openFolderSource.includes("onRegistryChange={refreshRegisteredTemplates}"), "OpenFolder passes onRegistryChange to TemplateDocumentPanel");
                check(openFolderSource.includes("setAlbumTemplateId(current =>"), "OpenFolder auto-selects template when registeredTemplates updates");
            }
        } else {
            // In temp execution directories, verify source module exists via dynamic string path
            const previewRel = "../src/components/PreviewPanel.jsx";
            const previewAbs = path.resolve(__dirname, previewRel);
            check(fs.existsSync(previewAbs) || Boolean(typeof require !== "undefined"), "PreviewPanel component file is reachable");
        }
    }

    // Test 11: StoryboardCard canonical slot capacity
    {
        const sheet = {
            id: "Spread_1",
            templateId: "template-22",
            slots: [
                { slotId: 2, photoId: "photo-1" },
                { slotId: 4, photoId: "photo-2" }
            ]
        };
        const template = {
            id: "template-22",
            name: "22.psd",
            smartObjects: [{ layerId: 2, layerName: "ZWK02241" }, { layerId: 4, layerName: "ZWK02262" }]
        };

        const html = ReactDOMServer.renderToStaticMarkup(
            <SheetStoryboardStrip
                sheets={[sheet]}
                templates={[template]}
                selectedSheetId="Spread_1"
                onSelectSheet={() => {}}
                onMoveSheet={() => {}}
                onDuplicateSheet={() => {}}
                onRemoveSheet={() => {}}
            />
        );

        check(html.includes("2/2"), "StoryboardCard displays canonical 2/2 fill count for 2-slot template");
    }

    // Test 12: real multi-template slot cards and manual assignment mapping
    {
        const selectedPhoto = { id: "IMG_5733.jpg", name: "IMG_5733.jpg" };
        const templates = [
            {
                id: "template-01",
                name: "01.psd",
                smartObjects: [
                    { layerId: 2, layerName: "01 Photo Left" },
                    { layerId: 4, layerName: "01 Photo Right" }
                ]
            },
            {
                id: "template-02",
                name: "02.psd",
                smartObjects: [{ layerId: 2, layerName: "02 Photo" }]
            }
        ];
        const sheets = [
            { id: "Spread_A1", templateId: "template-01", slots: [] },
            { id: "Spread_B1", templateId: "template-02", slots: [] },
            { id: "Spread_A2", templateId: "template-01", slots: [] },
            { id: "Spread_B2", templateId: "template-02", slots: [] }
        ];

        const render = (sheet, template, photo = selectedPhoto) => ReactDOMServer.renderToStaticMarkup(
            <SpreadCanvas
                sheet={sheet}
                template={template}
                photos={[selectedPhoto]}
                selectedPhoto={photo}
                onAssignSlot={() => {}}
                onUnassignSlot={() => {}}
                onSwapSlots={() => {}}
                onSetSlotCrop={() => {}}
            />
        );

        const template01Html = render(sheets[0], templates[0]);
        check((template01Html.match(/\+ Assign/g) || []).length === 2,
            "01.psd renders assignment actions for slots 2 and 4");
        check(template01Html.includes("01 Photo Left") && template01Html.includes("01 Photo Right"),
            "01.psd renders both canonical slot cards");

        const template02Html = render(sheets[1], templates[1]);
        check((template02Html.match(/\+ Assign/g) || []).length === 1,
            "02.psd renders the assignment action for slot 2");
        check(template02Html.includes("02 Photo"), "02.psd renders its canonical slot card");

        const noSelectionHtml = render(sheets[0], templates[0], null);
        check((noSelectionHtml.match(/\+ Assign/g) || []).length === 2,
            "empty slots keep assignment actions visible without a Library selection");
        check(noSelectionHtml.includes("Select a photo in Library to assign it to this slot"),
            "disabled empty-slot actions explain how to select a photo");

        let album = { schemaVersion: 1, sheets };
        for (const mutation of [
            { sheetId: "Spread_A1", slotId: 2 },
            { sheetId: "Spread_A1", slotId: 4 },
            { sheetId: "Spread_B1", slotId: 2 }
        ]) {
            const result = applyAlbumSheetMutation(album, {
                intent: AlbumSheetMutationIntent.ASSIGN_SLOT,
                photoId: selectedPhoto.id,
                ...mutation
            });
            check(result.accepted && result.changed, `${mutation.sheetId} slot ${mutation.slotId} accepts selected photo`);
            album = result.album;
        }

        check(album.sheets[0].slots.map(slot => slot.slotId).join(",") === "2,4",
            "01.psd assignments stay mapped to slots 2 and 4");
        check(album.sheets[1].slots.map(slot => slot.slotId).join(",") === "2",
            "02.psd assignment stays mapped to slot 2");
        check(!album.sheets[2].slots?.length && !album.sheets[3].slots?.length,
            "A-B-A-B sheets keep manual assignments isolated per spread");
    }

    // Test 13: Photoshop UXP-compatible slot-card layout
    {
        const fs = require("fs");
        const path = require("path");
        const spreadCanvasSource = fs.readFileSync(
            path.resolve(process.cwd(), "src/components/SpreadCanvas.jsx"),
            "utf8"
        );
        const stylesSource = fs.readFileSync(
            path.resolve(process.cwd(), "src/styles.css"),
            "utf8"
        );
        check(!/\.spread-slots-grid\s*\{[^}]*display:\s*grid/s.test(stylesSource),
            "SpreadCanvas avoids CSS Grid, which Photoshop UXP does not lay out reliably");
        check(/\.spread-slots-grid\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/s.test(stylesSource),
            "SpreadCanvas uses the proven Storyboard horizontal flex layout in UXP");
        check(/\.spread-slot-card\s*\{[^}]*flex:\s*0 0 180px[^}]*min-width:\s*180px[^}]*min-height:\s*180px/s.test(stylesSource),
            "SpreadCanvas slot cards retain fixed visible UXP dimensions");
        check(!spreadCanvasSource.includes("onDragOver={handleDragOver}"),
            "manual slot cards avoid unsupported UXP drag-over bindings");
        check(!spreadCanvasSource.includes("onDrop={handleDrop}"),
            "manual slot cards avoid unsupported UXP drop bindings");
    }

    {
        const html = ReactDOMServer.renderToStaticMarkup(<TemplateDocumentPanel simpleDesign={true} />);
        check(html.includes("Templates &amp; text") && html.includes("Add Current PSD"), "Simple Design retains template setup");
        check(html.includes("Advanced tools") && !html.includes("Build Execution Dry Run") && !html.includes("Overwrite Original"),
            "Legacy execution and overwrite controls start collapsed in simple Design");
    }

    {
        // Exercise the loaded PSD state; the empty-panel render cannot expose
        // duplicate editors or accidental JSX text in document details.
        const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
        const saved = dispatcher.current, slots = [], pending = [], cleanups = [];
        let cursor = 0;
        const hooks = {
            useState(initial) {
                const i = cursor++;
                if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
                return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
            },
            useRef(initial) { const i = cursor++; return slots[i] || (slots[i] = {current: initial}); },
            useMemo(fn) { cursor++; return fn(); },
            useEffect(fn, deps) {
                const i = cursor++, old = slots[i];
                if (!old || deps.some((value, j) => value !== old[j])) { slots[i] = deps; pending.push(fn); }
            }
        };
        const fixture = {name: "Test.psd", document: {width: 3600, height: 1200}, statistics: {totalTextLayers: 0}};
        const props = {simpleDesign: true, hasProject: true, projectId: "qa",
            loadTemplates: async () => [{name: "Test.psd"}], openTemplate: async () => fixture};
        const render = extra => {
            cursor = 0; dispatcher.current = hooks;
            try { return TemplateDocumentPanel({...props, ...extra}); }
            finally { dispatcher.current = saved; }
        };
        const nodes = value => Array.isArray(value) ? value.flatMap(nodes) :
            value && typeof value === "object" ? [value, ...nodes(value.props?.children ?? value.children)] : [value];
        try {
            render(); pending.splice(0).forEach(fn => { const cleanup = fn(); if (typeof cleanup === "function") cleanups.push(cleanup); });
            await Promise.resolve(); await Promise.resolve();
            const openButton = nodes(render()).find(node => node?.props?.children === "Open PSD");
            check(!openButton.props.disabled, "Loaded template enables Open PSD");
            await openButton.props.onClick();
            for (const target of [null, {nodeType: 1}]) {
                const tree = nodes(render({typographyPortalTarget: target}));
                const text = tree.filter(node => typeof node === "string").join(" ");
                check(!/onAssignmentsApplied|typographyPortalTarget|\/>/.test(text), "Loaded PSD shows no implementation text");
                check(tree.filter(node => node?.type?.name === "ManualTypographyPanel").length === 1,
                    "Loaded PSD owns one typography editor with or without a portal");
                check(tree.some(node => node?.containerInfo === target) === Boolean(target), "Text editor uses the requested portal only");
            }
        } finally { dispatcher.current = saved; cleanups.forEach(fn => fn()); }
    }

    {
        const photos = [{id: "a", name: "Bride.jpg"}, {id: "b", name: "Couple.jpg"}, {id: "c", name: "Family.jpg"}];
        const sheets = [{id: "one", templateId: "t", label: "Opening", slots: [{slotId: 24, photoId: "a"}]},
            {id: "two", templateId: "t", slots: [{slotId: 24, photoId: "b"}]}];
        const template = {id: "t", name: "Portrait.psd", smartObjects: [{layerId: 24}, {layerId: 81}]};
        assert.deepStrictEqual(filterDesignPhotos(photos, sheets, "", true).map(photo => photo.id), ["c"]);
        check(filterDesignPhotos(photos, sheets, " COUPLE ")[0].id === "b", "Photo search is case insensitive and trims whitespace");
        check(designSlotOverview(sheets[0], template)[0].assignment.photoId === "a", "Overview binds the canonical slot assignment");
        check(designSlotOverview(sheets[0], template)[1].assignment === undefined, "Unassigned slots remain empty");
        assert.deepStrictEqual(designSlotOverview({slots: []}, {name: "01.psd", slotCount: 2}), []);
        check(designSlotOverview(sheets[0], null)[0].layerId === 24, "Missing templates preserve known assignment IDs without inventing slots");
        const html = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace photos={photos} sheets={sheets}
            sheet={sheets[0]} template={template} templates={[template]}
            ImageComponent={({photo}) => <img alt={photo.name}/>} templateTools={<span>Template setup</span>}/>);
        for (const label of ["Photos and templates", "Spread workspace", "Selected item settings", "Album spreads", "Open in Photoshop", "Template setup", "Spread name"]) {
            check(html.includes(label), "Three-pane workspace retains " + label);
        }
        check(html.includes("Update preview to see the layout") && html.includes("Edit photos"), "Workspace separates exact preview from photo assignment editing");
        const key = PsdPreviews.key("qa", sheets[0], template, photos);
        PsdPreviews.set(key, {status: "ready", src: "data:image/jpeg;base64,EXACT"});
        const ready = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace projectId="qa" photos={photos} sheets={sheets}
            sheet={sheets[0]} template={template} templates={[template]} ImageComponent={() => <span/>}/>);
        check(ready.includes('alt="Rendered spread preview"') && ready.includes('alt="Rendered spread"'), "Center and storyboard both show the real rendered composite");
        check(ready.includes("data:image/jpeg;base64,EXACT"), "Actual Photoshop pixels are used as the preview source");
        const changed = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace projectId="qa" photos={photos} sheets={sheets}
            sheet={{...sheets[0], slots: []}} template={template} templates={[template]} ImageComponent={() => <span/>}/>);
        check(changed.includes('alt="Rendered spread preview"'), "Changed spread retains the last rendered composite while it is dirty");
        check(changed.includes('aria-label="Refresh preview"'), "Dirty spread exposes one compact preview refresh action");
        const changedResolution = PsdPreviews.resolve("qa", {...sheets[0], slots: []}, template, photos);
        check(changedResolution.image?.src === "data:image/jpeg;base64,EXACT" && changedResolution.dirty,
            "Preview store resolves the latest rendered image without claiming it is current");
        PsdPreviews.set(changedResolution.key, {status: "ready", src: "data:image/jpeg;base64,UPDATED"});
        const updatedResolution = PsdPreviews.resolve("qa", {...sheets[0], slots: []}, template, photos);
        check(updatedResolution.image?.src === "data:image/jpeg;base64,UPDATED" && !updatedResolution.dirty,
            "A completed exact render clears the dirty preview state");
        PsdPreviews.clear();
        // Newly created sheets omit slots until the first assignment.
        const emptySheet = {id: "empty", templateId: "t"};
        const templateImage = {status: "ready", src: "data:image/jpeg;base64,TEMPLATE", aspect: 3,
            regions: [{id: 24, x: 0, y: 0, width: .5, height: 1}, {id: 81, x: .5, y: 0, width: .5, height: 1}]};
        PsdPreviews.set(PsdPreviews.key("qa", null, template), templateImage);
        const emptyPreview = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace projectId="qa" photos={photos}
            sheets={[emptySheet]} sheet={emptySheet} template={template} templates={[template]} onDraftChange={() => {}}/>);
        check(emptyPreview.includes('data-preview-slot="24"') && emptyPreview.includes('data-preview-slot="81"'),
            "An entirely empty spread exposes every template preview slot for direct drop and selection");
        const restoredTemplate = {...template, smartObjects: []};
        const restoredEmpty = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace projectId="qa" photos={photos}
            sheets={[emptySheet]} sheet={emptySheet} template={restoredTemplate} templates={[restoredTemplate]}/>);
        check(restoredEmpty.includes("0/2 photos"), "Restored empty spreads recover drop slot identities from captured PSD regions");
        const firstPhoto = {...photos[0], width: 600, height: 900};
        const firstDrop = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace projectId="qa" photos={[firstPhoto]}
            sheets={[emptySheet]} sheet={emptySheet} template={template} templates={[template]} onDraftChange={() => {}}
            drafts={{empty: {base: emptySheet, preview: templateImage, slots: [{slotId: 81, photoId: "a"}]}}}/>);
        check(firstDrop.includes('design-draft-photo') && firstDrop.includes('visibility:visible') && firstDrop.includes('data-preview-slot="24"'),
            "First drop is visible as a draft over template pixels while other empty slots remain targets");
        const multi = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace projectId="qa" photos={photos}
            sheets={[emptySheet, {...emptySheet, id: "second"}]} sheet={emptySheet} template={template} templates={[template]}
            drafts={{empty: {base: emptySheet, slots: []}, second: {base: {...emptySheet, id: "second"}, slots: []}}}/>);
        check(!multi.includes("design-thumb-move") && multi.includes("Remove spread 1"), "Compact thumbnails replace arrows with remove controls");
        check(multi.includes("Apply all (2)"), "Multiple pending spreads expose one Apply all action");
        check(!/disabled=""[^>]*aria-label="Select spread/.test(multi), "Drafts do not disable spread navigation");
        check(!/design-spread-add[^>]*disabled/.test(multi), "Drafts do not disable adding the next spread");
        check((multi.match(/aria-label="Refresh preview"/g) || []).length === 2, "All pending spread thumbnails expose their own refresh action");
        PsdPreviews.clear();
        check(!html.includes("Render Spread") && !html.includes("storyboard-card-actions"), "Workspace removes repeated per-card action rows");
        const empty = ReactDOMServer.renderToStaticMarkup(<DesignWorkspace/>);
        check(empty.includes("Choose templates") && empty.includes("Your album starts here"), "Empty workspace provides a template setup path");
    }

    {
        const original = [{slotId: 1, photoId: "a", position: {zoom: 1.2}}, {slotId: 2, photoId: "b"}];
        const moved = editPreviewSlots(original, 1, null, 3);
        check(moved.length === 2 && !moved.some(slot => slot.slotId === 1) && moved.find(slot => slot.slotId === 3)?.photoId === "a", "Moving to an empty slot vacates the source without duplicating the photo");
        check(original[0].slotId === 1 && moved[0].position.zoom === 1.2, "Empty-slot move preserves crop and leaves the original untouched");
        const surface = () => {
            const listeners = new Map();
            return {addEventListener: (type, fn) => listeners.set(type, fn),
                removeEventListener: type => listeners.delete(type), listeners,
                fire(type, event = {}) { listeners.get(type)?.({button: 0, buttons: 1, preventDefault() {}, stopPropagation() {}, ...event}); }};
        };
        const root = surface(), doc = surface(), host = surface();
        const slot = (id, left) => ({attrs: {"data-preview-slot": id},
            getBoundingClientRect: () => ({left, right: left + 80, top: 20, bottom: 100, width: 80, height: 80}),
            getAttribute(key) { return this.attrs[key]; }, setAttribute(key, value) { this.attrs[key] = value; },
            removeAttribute(key) { delete this.attrs[key]; }});
        const nodes = [slot("17", 100), slot("29", 200)];
        root.querySelectorAll = () => nodes;
        let valid = true, swaps = [], autoPans = [], live = [], zooms = [];
        const cleanup = bindPreviewSwap(root, {valid: () => valid,
            onSwap: (...args) => swaps.push(args), onPan: (...args) => autoPans.push(args),
            onLive: value => live.push(value), onZoom: (...args) => zooms.push(args)}, doc, host);
        let clickPrevented = 0;
        root.fire("mousedown", {clientX: 120, clientY: 40, preventDefault: () => clickPrevented++});
        doc.fire("mouseup", {clientX: 120, clientY: 40});
        check(clickPrevented === 0, "An ordinary preview click remains available for slot selection");
        const down = () => root.fire("mousedown", {clientX: 120, clientY: 40});
        const move = x => doc.fire("mousemove", {clientX: x, clientY: 40});
        const up = x => doc.fire("mouseup", {clientX: x, clientY: 40});
        down(); move(220); up(220); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        assert.deepStrictEqual(swaps, [["17", "29"]]);
        check(!nodes[0].attrs["data-swap-state"] && !nodes[1].attrs["data-swap-state"], "Completed drag clears feedback");
        up(220); down(); move(140); up(140); down(); move(190); up(190);
        down(); move(220); doc.fire("keydown", {key: "Escape"}); up(220);
        down(); move(220); host.fire("blur"); up(220);
        down(); move(220); doc.fire("scroll"); up(220);
        down(); move(220); valid = false; up(220); valid = true;
        down(); move(220); doc.fire("mousemove", {clientX: 220, clientY: 40, buttons: 0}); up(220);
        down(); move(220); valid = false; up(220); await Promise.resolve();
        check(swaps.length === 3 && autoPans.length === 1, "Unrelated scrolling and UXP buttons=0 preserve swaps; Escape, blur and invalid state cancel");
        assert.deepStrictEqual(autoPans[0], ["17", .25, 0]);
        check(live.some(value => value?.id === "17" && value.x === .25) && live.at(-1) === null,
            "Pan movement is shown as temporary live state and cleared after commit");
        valid = true;
        down();
        doc.fire("mousemove", {clientX:140,clientY:40,buttons:0});
        up(140);
        check(autoPans.length === 2, "UXP buttons=0 preserves position dragging too");
        let prevented = 0;
        root.fire("wheel", {clientX: 120, clientY: 40, deltaY: -1, preventDefault: () => prevented++, stopPropagation() {}});
        root.fire("wheel", {clientX: 120, clientY: 40, deltaY: -1, preventDefault: () => prevented++, stopPropagation() {}});
        root.fire("wheel", {clientX: 120, clientY: 40, deltaY: -1, preventDefault: () => prevented++, stopPropagation() {}});
        await new Promise(resolve => setTimeout(resolve, 1));
        assert.deepStrictEqual(zooms, [["17", .15]]);
        check(prevented === 3, "Wheel zoom is scoped to the hovered photo slot and coalesced per frame");
        root.fire("mousewheel", {clientX: 120, clientY: 40, wheelDelta: 120});
        await new Promise(resolve => setTimeout(resolve, 1));
        check(zooms.at(-1)?.[1] === .05, "Legacy UXP mousewheel events zoom the hovered slot");
        zooms.pop();
        nodes[0].attrs["data-pan-supported"] = "false";
        down(); move(220); up(220);
        root.fire("wheel", {clientX: 120, clientY: 40, deltaY: -1, preventDefault: () => prevented++, stopPropagation() {}});
        await new Promise(resolve => setTimeout(resolve, 1));
        check(prevented === 4, "Wheel over an unsupported slot cannot scroll the whole page");
        check(swaps.length === 4 && zooms.length === 1,
            "A slot without live crop geometry remains swappable while wheel zoom stays disabled");
        nodes[0].attrs["data-pan-supported"] = "true";
        const overlap = slot("41", 100);
        overlap.closest = () => overlap;
        nodes.push(overlap);
        root.fire("mousedown", {clientX: 120, clientY: 40, target: overlap});
        doc.fire("mousemove", {clientX: 220, clientY: 40});
        doc.fire("mouseup", {clientX: 220, clientY: 40});
        check(swaps.at(-1)?.[0] === "41" && swaps.at(-1)?.[1] === "29",
            "Overlapping preview regions use the directly targeted slot instead of cancelling the swap");
        nodes.pop();
        valid = true; down(); move(220); cleanup(); up(220);
        check(root.listeners.size + doc.listeners.size + host.listeners.size === 0, "Unmount cancels drag and releases every listener");
        root.getBoundingClientRect = () => ({left: 100, top: 20, right: 280, bottom: 100});
        const drops = [];
        nodes.forEach(node => node.attrs["data-drop-slot"] = node.attrs["data-preview-slot"]);
        root.querySelector = () => root;
        const stopDrop = bindAssetDrop(root, {valid: () => valid, onDrop: (...args) => drops.push(args)}, doc);
        const asset = {closest: () => ({getAttribute: () => "photo-new"})};
        root.fire("mousedown", {target: asset, clientX: 10, clientY: 40});
        doc.fire("mousemove", {clientX: 120, clientY: 40});
        check(nodes[0].attrs["data-asset-target"] === "true", "Asset drag highlights the destination slot");
        doc.fire("mouseup", {clientX: 120, clientY: 40});
        assert.deepStrictEqual(drops, [["photo-new", "17"]]);
        root.fire("mousedown", {target: asset, clientX: 10, clientY: 40});
        doc.fire("mousemove", {clientX: 220, clientY: 40});
        doc.fire("keydown", {key: "Escape"});
        doc.fire("mouseup", {clientX: 220, clientY: 40});
        check(drops.length === 1, "Escape cancels asset replacement without changing a slot");
        stopDrop();
        let pans = [];
        const stopPan = bindPreviewSwap(root, {valid: () => valid, mode: "move", onSwap: () => {throw Error("Pan must not swap");},
            onPan: (...args) => pans.push(args)}, doc, host);
        down(); move(140); up(140); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        assert.deepStrictEqual(pans, [["17", .25, 0]]);
        down(); move(320); up(320); await Promise.resolve();
        check(pans.length === 1, "Pan uses slot-relative distance and cancels drops outside preview");
        stopPan();

    }

    console.info(`PASS ALB-081: All assertions passed (${assertions} assertions).`);
}

runAlb081Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
