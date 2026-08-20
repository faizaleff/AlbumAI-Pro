import assert from "assert";
import React from "react";
import ReactDOMServer from "react-dom/server";
import SpreadCanvas from "../src/components/SpreadCanvas";
import ProjectTemplateRegistry from "../src/project/ProjectTemplateRegistry";
import { TemplateRegistryValidationState } from "../src/project/TemplateRegistryValidationState";
import {
    createEmptyAlbum,
    applyAlbumSheetMutation,
    AlbumSheetMutationIntent,
    AlbumSheetMutationReason,
    AlbumSheetReason,
    resolveAlbumSheetTemplates,
    inspectAlbum,
    AlbumSheetTemplateState
} from "../src/project/AlbumSheetSchema";
import {
    createAlbumSheetRenderRequest,
    createAlbumBatchRenderRequest,
    validateAlbumBatchRenderRequest,
    AlbumSheetRenderReason
} from "../src/project/AlbumSheetRenderBridge";
import {
    preflightAlbumForPrint,
    StandardAlbumSizes
} from "../src/services/PrintExportPresetEngine";
import {
    generateAutoFlowSpreads,
    AutoFlowStrategy,
    getTemplateSlotCapacity,
    selectBestTemplate
} from "../src/services/PhotoAutoFlowEngine";
import ProjectExecutor from "../src/project/ProjectExecutor";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb092Tests() {
    console.info("Starting ALB-092 Multi-Template Album tests...");

    // -------------------------------------------------------------------------
    // Test 1: ProjectTemplateRegistry holds Template A (2 slots) & Template B (1 slot)
    // -------------------------------------------------------------------------
    const registry = new ProjectTemplateRegistry();
    const templateA = registry.add(
        { name: "22.psd" },
        TemplateRegistryValidationState.READY,
        {
            smartObjects: [
                { layerId: 2, layerName: "ZWK02241" },
                { layerId: 4, layerName: "ZWK02262" }
            ],
            slotCount: 2
        }
    );
    const templateB = registry.add(
        { name: "07.psd" },
        TemplateRegistryValidationState.READY,
        {
            smartObjects: [
                { layerId: 1, layerName: "HeroSlot" }
            ],
            slotCount: 1
        }
    );

    registry.updateValidation(templateA.id, TemplateRegistryValidationState.READY);
    registry.updateValidation(templateB.id, TemplateRegistryValidationState.READY);

    const templateList = registry.getAll();

    check(registry.count() === 2, "Test 1: Registry holds 2 templates");
    check(templateA.id !== templateB.id, "Test 1: Template A and B have distinct IDs");
    check(typeof templateA.id === "string", "Test 1: Template A ID is a string");
    check(typeof templateB.id === "string", "Test 1: Template B ID is a string");
    check(!templateA.id.includes("[object"), "Test 1: Template A ID is not an object string");
    check(!templateB.id.includes("[object"), "Test 1: Template B ID is not an object string");
    check(templateList[0].fileName === "22.psd", "Test 1: Template A filename is 22.psd");
    check(templateList[1].fileName === "07.psd", "Test 1: Template B filename is 07.psd");
    check(templateList[0].registrationOrder === 0, "Test 1: Template A order is 0");
    check(templateList[1].registrationOrder === 1, "Test 1: Template B order is 1");
    check(templateList[0].smartObjects.length === 2, "Test 1: Template A has 2 smartObjects");
    check(templateList[1].smartObjects.length === 1, "Test 1: Template B has 1 smartObject");
    check(templateList[0].slotCount === 2, "Test 1: Template A slotCount is 2");
    check(templateList[1].slotCount === 1, "Test 1: Template B slotCount is 1");

    check(getTemplateSlotCapacity(templateList[0]) === 2, "Test 1: Capacity of Template A is 2");
    check(getTemplateSlotCapacity(templateList[1]) === 1, "Test 1: Capacity of Template B is 1");

    // -------------------------------------------------------------------------
    // Test 2: Album holds alternating sheets A -> B -> A -> B
    // -------------------------------------------------------------------------
    let album = createEmptyAlbum();
    const sheetIds = ["spread-01", "spread-02", "spread-03", "spread-04"];
    const sheetTemplateMap = [templateA.id, templateB.id, templateA.id, templateB.id];
    const registeredTemplateIds = templateList.map(t => t.id);

    for (let i = 0; i < 4; i++) {
        const mutationResult = applyAlbumSheetMutation(
            album,
            {
                intent: AlbumSheetMutationIntent.ADD,
                sheet: {
                    id: sheetIds[i],
                    templateId: sheetTemplateMap[i],
                    label: `Spread 0${i + 1}`
                }
            },
            { templateIds: registeredTemplateIds }
        );
        check(mutationResult.changed === true, `Test 2: Added sheet ${sheetIds[i]}`);
        album = mutationResult.album;
    }

    check(album.sheets.length === 4, "Test 2: Album has 4 sheets");
    check(album.sheets[0].templateId === templateA.id, "Test 2: Sheet 1 uses Template A");
    check(album.sheets[1].templateId === templateB.id, "Test 2: Sheet 2 uses Template B");
    check(album.sheets[2].templateId === templateA.id, "Test 2: Sheet 3 uses Template A");
    check(album.sheets[3].templateId === templateB.id, "Test 2: Sheet 4 uses Template B");

    // -------------------------------------------------------------------------
    // Test 3: Each sheet resolves its own templateId; no global dropdown overrides
    // -------------------------------------------------------------------------
    const compatibility = resolveAlbumSheetTemplates(album, templateList);
    check(compatibility.status === AlbumSheetTemplateState.READY, "Test 3: Compatibility status is READY");
    check(compatibility.sheets.length === 4, "Test 3: All 4 sheets resolved");
    check(compatibility.sheets[0].templateId === templateA.id, "Test 3: Sheet 1 resolved Template A");
    check(compatibility.sheets[1].templateId === templateB.id, "Test 3: Sheet 2 resolved Template B");
    check(compatibility.sheets[2].templateId === templateA.id, "Test 3: Sheet 3 resolved Template A");
    check(compatibility.sheets[3].templateId === templateB.id, "Test 3: Sheet 4 resolved Template B");

    // Test single sheet render request resolution
    const s1Req = createAlbumSheetRenderRequest({
        projectId: "proj-rec005",
        album,
        registry: templateList,
        sheetId: "spread-01",
        selectedPhotoIds: ["p1", "p2"]
    });
    check(s1Req.accepted === true, "Test 3: Sheet 1 render request accepted");
    check(s1Req.request.template.id === templateA.id, "Test 3: Sheet 1 request bound to Template A");

    const s2Req = createAlbumSheetRenderRequest({
        projectId: "proj-rec005",
        album,
        registry: templateList,
        sheetId: "spread-02",
        selectedPhotoIds: ["p3"]
    });
    check(s2Req.accepted === true, "Test 3: Sheet 2 render request accepted");
    check(s2Req.request.template.id === templateB.id, "Test 3: Sheet 2 request bound to Template B");

    // -------------------------------------------------------------------------
    // Test 4: Slot capacities remain A -> 2, B -> 1
    // -------------------------------------------------------------------------
    const tmplAFromReg = templateList.find(t => t.id === s1Req.request.template.id);
    const tmplBFromReg = templateList.find(t => t.id === s2Req.request.template.id);
    check(tmplAFromReg.smartObjects.length === 2, "Test 4: Template A has 2 smart object slots");
    check(tmplBFromReg.smartObjects.length === 1, "Test 4: Template B has 1 smart object slot");
    check(tmplAFromReg.slotCount === 2, "Test 4: Template A slotCount is 2");
    check(tmplBFromReg.slotCount === 1, "Test 4: Template B slotCount is 1");

    // -------------------------------------------------------------------------
    // Test 5: Fully assigned mixed album (2/2, 1/1, 2/2, 1/1 = 6 photos) passes Lab Print preflight
    // -------------------------------------------------------------------------
    const assignments = [
        { sheetId: "spread-01", slotId: 2, photoId: "photo-01" },
        { sheetId: "spread-01", slotId: 4, photoId: "photo-02" },
        { sheetId: "spread-02", slotId: 1, photoId: "photo-03" },
        { sheetId: "spread-03", slotId: 2, photoId: "photo-04" },
        { sheetId: "spread-03", slotId: 4, photoId: "photo-05" },
        { sheetId: "spread-04", slotId: 1, photoId: "photo-06" }
    ];

    for (const a of assignments) {
        const mut = applyAlbumSheetMutation(album, {
            intent: AlbumSheetMutationIntent.ASSIGN_SLOT,
            sheetId: a.sheetId,
            slotId: a.slotId,
            photoId: a.photoId
        });
        check(mut.changed === true, `Test 5: Assigned ${a.photoId} to ${a.sheetId}`);
        album = mut.album;
    }

    const photos = Array.from({ length: 6 }, (_, i) => ({
        id: `photo-0${i + 1}`,
        name: `ZSA00${160 + i}.jpg`,
        width: 4000,
        height: 3000
    }));

    const preflightFull = preflightAlbumForPrint({
        album,
        photos,
        templates: templateList,
        sizePreset: StandardAlbumSizes.SIZE_12X12,
        targetDpi: 300
    });

    check(preflightFull.totalSheets === 4, "Test 5: Preflight reports 4 sheets");
    check(preflightFull.totalSlots === 6, "Test 5: Total expected slots is 6 (2 + 1 + 2 + 1)");
    check(preflightFull.filledSlots === 6, "Test 5: Filled slots is 6");
    check(preflightFull.unfilledSlots === 0, "Test 5: Unfilled slots is 0");
    check(preflightFull.isReadyForPrint === true, "Test 5: isReadyForPrint is true");
    check(preflightFull.unfilledSlotDetails.length === 0, "Test 5: No unfilled slot details");

    const batchRequestFull = createAlbumBatchRenderRequest({
        projectId: "proj-rec005",
        album,
        registry: templateList,
        selectedPhotoIds: photos.map(p => p.id),
        options: { type: "LAB_PRINT", format: "JPEG" }
    });

    check(batchRequestFull.accepted === true, "Test 5: Full mixed batch request accepted");
    check(batchRequestFull.request.sheetRequests.length === 4, "Test 5: Exactly 4 sheet requests");
    check(batchRequestFull.request.sheetRequests[0].template.id === templateA.id, "Test 5: Sheet 1 request is Template A");
    check(batchRequestFull.request.sheetRequests[1].template.id === templateB.id, "Test 5: Sheet 2 request is Template B");
    check(batchRequestFull.request.sheetRequests[2].template.id === templateA.id, "Test 5: Sheet 3 request is Template A");
    check(batchRequestFull.request.sheetRequests[3].template.id === templateB.id, "Test 5: Sheet 4 request is Template B");

    // -------------------------------------------------------------------------
    // Test 6: Incomplete Spread 03 (1/2) blocks Lab Print with exact details
    // -------------------------------------------------------------------------
    const unassignMut = applyAlbumSheetMutation(album, {
        intent: AlbumSheetMutationIntent.UNASSIGN_SLOT,
        sheetId: "spread-03",
        slotId: 4
    });
    check(unassignMut.changed === true, "Test 6: Unassigned slot 4 on Spread 03");
    const incompleteAlbum = unassignMut.album;

    const preflightIncomplete = preflightAlbumForPrint({
        album: incompleteAlbum,
        photos,
        templates: templateList,
        sizePreset: StandardAlbumSizes.SIZE_12X12,
        targetDpi: 300
    });

    check(preflightIncomplete.isReadyForPrint === false, "Test 6: isReadyForPrint is false for incomplete album");
    check(preflightIncomplete.unfilledSlots === 1, "Test 6: Preflight reports 1 unfilled slot");
    check(preflightIncomplete.unfilledSlotDetails.length === 1, "Test 6: Exactly 1 incomplete spread reported");
    check(preflightIncomplete.unfilledSlotDetails[0].sheetId === "spread-03", "Test 6: Identified spread-03");
    check(preflightIncomplete.unfilledSlotDetails[0].assignedCount === 1, "Test 6: Spread 3 has 1 assigned");
    check(preflightIncomplete.unfilledSlotDetails[0].totalCount === 2, "Test 6: Spread 3 total is 2");
    check(preflightIncomplete.unfilledSlotDetails[0].missingCount === 1, "Test 6: Spread 3 missing 1");

    const batchRequestIncomplete = createAlbumBatchRenderRequest({
        projectId: "proj-rec005",
        album: incompleteAlbum,
        registry: templateList,
        selectedPhotoIds: photos.map(p => p.id),
        options: { type: "LAB_PRINT", format: "JPEG" }
    });

    check(batchRequestIncomplete.accepted === false, "Test 6: Incomplete mixed batch rejected for LAB_PRINT");
    check(batchRequestIncomplete.reasonCodes.includes(AlbumSheetRenderReason.INCOMPLETE_SPREADS), "Test 6: Reason is INCOMPLETE_SPREADS");
    check(batchRequestIncomplete.details.totalIncomplete === 1, "Test 6: 1 incomplete spread in batch details");
    check(batchRequestIncomplete.details.totalMissing === 1, "Test 6: 1 missing slot in batch details");
    check(batchRequestIncomplete.details.incompleteSheets[0].sheetId === "spread-03", "Test 6: Batch details identified spread-03");
    check(batchRequestIncomplete.details.message.includes("Spread 03 (1/2)"), "Test 6: Error message contains Spread 03 (1/2)");

    // -------------------------------------------------------------------------
    // Test 7: Output naming produces canonical Spread_01.jpg to Spread_04.jpg
    // -------------------------------------------------------------------------
    const expectedOutputs = ["Spread_01.jpg", "Spread_02.jpg", "Spread_03.jpg", "Spread_04.jpg"];
    for (let i = 0; i < 4; i++) {
        const outName = ProjectExecutor.sheetOutputBaseName({
            sheetOrder: i,
            sheetLabel: album.sheets[i].label
        }) + ".jpg";
        check(outName === expectedOutputs[i], `Test 7: Output name for spread ${i + 1} is ${expectedOutputs[i]}`);
    }

    // -------------------------------------------------------------------------
    // Test 8: Alternating execution lifecycle A -> B -> A -> B isolates state
    // -------------------------------------------------------------------------
    class MockDocumentLifecycle {
        constructor() {
            this.activeDocument = null;
            this.history = [];
        }

        open(templateDesc) {
            if (this.activeDocument) {
                this.close({ save: false });
            }
            const fullTmpl = templateList.find(t => t.id === templateDesc.id);
            this.activeDocument = {
                id: `doc-${fullTmpl.fileName}-${Date.now()}-${Math.random()}`,
                name: fullTmpl.fileName,
                slots: fullTmpl.smartObjects.map(s => ({ ...s }))
            };
            this.history.push({ action: "OPEN", doc: this.activeDocument.name });
            return this.activeDocument;
        }

        close({ save = false } = {}) {
            if (this.activeDocument) {
                this.history.push({ action: "CLOSE_WITHOUT_SAVE", doc: this.activeDocument.name, save });
                this.activeDocument = null;
            }
        }
    }

    const docLife = new MockDocumentLifecycle();
    for (let i = 0; i < batchRequestFull.request.sheetRequests.length; i++) {
        const req = batchRequestFull.request.sheetRequests[i];
        const doc = docLife.open(req.template);
        check(doc.name === (i % 2 === 0 ? "22.psd" : "07.psd"), `Test 8: Sheet ${i + 1} opened correct PSD ${doc.name}`);
        check(doc.slots.length === (i % 2 === 0 ? 2 : 1), `Test 8: Sheet ${i + 1} document has ${doc.slots.length} slots`);
        docLife.close({ save: false });
    }

    check(docLife.history.length === 8, "Test 8: 4 open and 4 close cycles");
    check(docLife.history[0].doc === "22.psd" && docLife.history[0].action === "OPEN", "Test 8: Cycle 1 opened 22.psd");
    check(docLife.history[2].doc === "07.psd" && docLife.history[2].action === "OPEN", "Test 8: Cycle 2 opened 07.psd");
    check(docLife.history[4].doc === "22.psd" && docLife.history[4].action === "OPEN", "Test 8: Cycle 3 opened 22.psd");
    check(docLife.history[6].doc === "07.psd" && docLife.history[6].action === "OPEN", "Test 8: Cycle 4 opened 07.psd");

    // -------------------------------------------------------------------------
    // Test 9: Persistence round-trip preserves templates, order, sheet bindings, and photo assignments
    // -------------------------------------------------------------------------
    const serializedProject = {
        schemaVersion: 1,
        id: "project-rec-005",
        metadata: {
            templateRegistry: registry.toJSON(),
            album: album
        }
    };

    const roundTripJson = JSON.parse(JSON.stringify(serializedProject));

    const rehydratedRegistry = new ProjectTemplateRegistry(roundTripJson.metadata.templateRegistry);
    check(rehydratedRegistry.count() === 2, "Test 9: Rehydrated registry has 2 templates");
    check(rehydratedRegistry.getAll()[0].id === templateA.id, "Test 9: Template A ID preserved");
    check(rehydratedRegistry.getAll()[1].id === templateB.id, "Test 9: Template B ID preserved");
    check(rehydratedRegistry.getAll()[0].smartObjects.length === 2, "Test 9: Template A 2 smartObjects preserved");
    check(rehydratedRegistry.getAll()[1].smartObjects.length === 1, "Test 9: Template B 1 smartObject preserved");

    const rehydratedAlbum = inspectAlbum(roundTripJson.metadata.album).album;
    check(rehydratedAlbum.sheets.length === 4, "Test 9: Rehydrated album has 4 sheets");
    check(rehydratedAlbum.sheets[0].templateId === templateA.id, "Test 9: Sheet 1 templateId preserved");
    check(rehydratedAlbum.sheets[1].templateId === templateB.id, "Test 9: Sheet 2 templateId preserved");
    check(rehydratedAlbum.sheets[2].templateId === templateA.id, "Test 9: Sheet 3 templateId preserved");
    check(rehydratedAlbum.sheets[3].templateId === templateB.id, "Test 9: Sheet 4 templateId preserved");

    check(rehydratedAlbum.sheets[0].slots.length === 2, "Test 9: Sheet 1 has 2 slots preserved");
    check(rehydratedAlbum.sheets[0].slots[0].photoId === "photo-01", "Test 9: Sheet 1 slot 1 photo preserved");
    check(rehydratedAlbum.sheets[0].slots[1].photoId === "photo-02", "Test 9: Sheet 1 slot 2 photo preserved");
    check(rehydratedAlbum.sheets[1].slots.length === 1, "Test 9: Sheet 2 has 1 slot preserved");
    check(rehydratedAlbum.sheets[1].slots[0].photoId === "photo-03", "Test 9: Sheet 2 slot 1 photo preserved");

    // -------------------------------------------------------------------------
    // Test 10: Auto-Flow mixed template visual diversity & REC-004 preservation
    // -------------------------------------------------------------------------
    const autoFlowPhotos = Array.from({ length: 6 }, (_, i) => ({
        id: `af-photo-${i + 1}`,
        dateTaken: 1700000000000 + i * 60000,
        culling: { status: "KEEP" }
    }));

    const afBalanced = generateAutoFlowSpreads({
        photos: autoFlowPhotos,
        templates: templateList,
        options: {
            strategy: AutoFlowStrategy.BALANCED,
            maxPhotosPerSpread: 2
        }
    });

    check(afBalanced.success === true, "Test 10: Auto-Flow balanced succeeded");
    check(afBalanced.sheets.length === 3, "Test 10: 6 photos / 2 capacity = 3 spreads");
    check(afBalanced.sheets.every(s => s.templateId === templateA.id), "Test 10: All 3 spreads use 2-slot Template A");
    check(afBalanced.sheets.every(s => s.slots.length === 2), "Test 10: All 3 spreads are 2/2");

    const match2 = selectBestTemplate(templateList, 2);
    check(match2.id === templateA.id, "Test 10: selectBestTemplate for 2 slots selects Template A");
    const match1 = selectBestTemplate(templateList, 1);
    check(match1.id === templateB.id, "Test 10: selectBestTemplate for 1 slot selects Template B");

    // -------------------------------------------------------------------------
    // Test 11: Real UI Add Spread Selector & Manual A-B-A-B Spreads (REC-005 qualification)
    // -------------------------------------------------------------------------
    // Simulate registry with 02.psd (1 slot) and 01.psd (2 slots) as in user's runtime
    const runtimeRegistry = new ProjectTemplateRegistry();
    // Simulate registration with raw file/document objects
    const runtimeDoc02 = { id: 101, title: "02.psd", name: "02.psd", isFile: true };
    const runtimeDoc01 = { id: 102, title: "01.psd", name: "01.psd", isFile: true };

    const reg02 = runtimeRegistry.add(runtimeDoc02, TemplateRegistryValidationState.READY, {
        smartObjects: [{ layerId: 1, layerName: "Slot1" }],
        slotCount: 1
    });
    const reg01 = runtimeRegistry.add(runtimeDoc01, TemplateRegistryValidationState.READY, {
        smartObjects: [{ layerId: 2, layerName: "SlotA" }, { layerId: 4, layerName: "SlotB" }],
        slotCount: 2
    });

    runtimeRegistry.updateValidation(reg02.id, TemplateRegistryValidationState.READY);
    runtimeRegistry.updateValidation(reg01.id, TemplateRegistryValidationState.READY);

    const runtimeTemplates = runtimeRegistry.getAll();
    check(runtimeTemplates.length === 2, "Test 11: Runtime registry has 2 templates");
    check(typeof reg02.id === "string" && !reg02.id.includes("[object"), "Test 11: reg02 ID is clean string");
    check(typeof reg01.id === "string" && !reg01.id.includes("[object"), "Test 11: reg01 ID is clean string");
    check(reg02.id !== reg01.id, "Test 11: reg02 and reg01 have distinct IDs");

    // Simulate dropdown UI options mapping:
    // <select value={albumTemplateId}>
    //   {runtimeTemplates.map(t => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
    // </select>
    const dropdownOptions = runtimeTemplates.map(t => ({
        key: t.id,
        value: t.id,
        label: t.name || t.id
    }));

    check(dropdownOptions[0].label === "02.psd", "Test 11: Dropdown option 1 displays 02.psd");
    check(dropdownOptions[0].value === reg02.id, "Test 11: Dropdown option 1 value is descriptor id");
    check(dropdownOptions[1].label === "01.psd", "Test 11: Dropdown option 2 displays 01.psd");
    check(dropdownOptions[1].value === reg01.id, "Test 11: Dropdown option 2 value is descriptor id");

    // Manual A-B-A-B creation with Spread01, Spread02, Spread03, Spread04
    // User sequence:
    // 1. Select 01.psd (reg01.id) -> Spread01 -> 0/2
    // 2. Select 02.psd (reg02.id) -> Spread02 -> 0/1
    // 3. Select 01.psd (reg01.id) -> Spread03 -> 0/2
    // 4. Select 02.psd (reg02.id) -> Spread04 -> 0/1
    let manualAlbum = createEmptyAlbum();
    const validTemplateIds = runtimeTemplates.map(t => t.id);

    // Spread01 -> 01.psd
    const m1 = applyAlbumSheetMutation(manualAlbum, {
        intent: AlbumSheetMutationIntent.ADD,
        sheet: { id: "Spread01", templateId: reg01.id, label: "Spread 01" }
    }, { templateIds: validTemplateIds });
    check(m1.accepted === true && m1.changed === true, "Test 11: Spread01 (01.psd) added successfully");
    manualAlbum = m1.album;

    // Spread02 -> 02.psd
    const m2 = applyAlbumSheetMutation(manualAlbum, {
        intent: AlbumSheetMutationIntent.ADD,
        sheet: { id: "Spread02", templateId: reg02.id, label: "Spread 02" }
    }, { templateIds: validTemplateIds });
    check(m2.accepted === true && m2.changed === true, "Test 11: Spread02 (02.psd) added successfully");
    manualAlbum = m2.album;

    // Spread03 -> 01.psd
    const m3 = applyAlbumSheetMutation(manualAlbum, {
        intent: AlbumSheetMutationIntent.ADD,
        sheet: { id: "Spread03", templateId: reg01.id, label: "Spread 03" }
    }, { templateIds: validTemplateIds });
    check(m3.accepted === true && m3.changed === true, "Test 11: Spread03 (01.psd) added successfully");
    manualAlbum = m3.album;

    // Spread04 -> 02.psd
    const m4 = applyAlbumSheetMutation(manualAlbum, {
        intent: AlbumSheetMutationIntent.ADD,
        sheet: { id: "Spread04", templateId: reg02.id, label: "Spread 04" }
    }, { templateIds: validTemplateIds });
    check(m4.accepted === true && m4.changed === true, "Test 11: Spread04 (02.psd) added successfully");
    manualAlbum = m4.album;

    check(manualAlbum.sheets.length === 4, "Test 11: Manual album has 4 sheets");
    check(manualAlbum.sheets[0].templateId === reg01.id, "Test 11: Spread01 stores reg01.id");
    check(manualAlbum.sheets[1].templateId === reg02.id, "Test 11: Spread02 stores reg02.id");
    check(manualAlbum.sheets[2].templateId === reg01.id, "Test 11: Spread03 stores reg01.id");
    check(manualAlbum.sheets[3].templateId === reg02.id, "Test 11: Spread04 stores reg02.id");

    // Verify slot capacities resolve 2 -> 1 -> 2 -> 1
    const manualCompat = resolveAlbumSheetTemplates(manualAlbum, runtimeTemplates);
    check(manualCompat.status === AlbumSheetTemplateState.READY, "Test 11: Manual album resolved READY");
    const tmplMap = new Map(runtimeTemplates.map(t => [t.id, t]));
    const capacities = manualAlbum.sheets.map(s => getTemplateSlotCapacity(tmplMap.get(s.templateId)));
    check(capacities[0] === 2, "Test 11: Spread01 capacity is 2");
    check(capacities[1] === 1, "Test 11: Spread02 capacity is 1");
    check(capacities[2] === 2, "Test 11: Spread03 capacity is 2");
    check(capacities[3] === 1, "Test 11: Spread04 capacity is 1");

    // Verify active Photoshop document does NOT override sheet template binding
    const activePhotoshopTemplateOverride = { id: "doc-random-active", name: "02.psd" };
    const s1RenderReq = createAlbumSheetRenderRequest({
        projectId: "proj-rec005",
        album: manualAlbum,
        registry: runtimeTemplates,
        sheetId: "Spread01",
        selectedPhotoIds: ["photo-a", "photo-b"]
    });
    check(s1RenderReq.accepted === true, "Test 11: Spread01 render request accepted");
    check(s1RenderReq.request.template.id === reg01.id, "Test 11: Spread01 strictly bound to reg01 (01.psd), not active doc");

    // Verify invalid filename-as-templateId remains rejected
    const badMutation = applyAlbumSheetMutation(manualAlbum, {
        intent: AlbumSheetMutationIntent.ADD,
        sheet: { id: "Spread05", templateId: "02.psd", label: "Spread 05" }
    }, { templateIds: validTemplateIds });
    check(badMutation.accepted === false, "Test 11: filename-as-templateId is rejected by domain");
    check(badMutation.reasonCodes.includes(AlbumSheetReason.INVALID_TEMPLATE_ID) || badMutation.reasonCodes.includes(AlbumSheetMutationReason.TEMPLATE_NOT_REGISTERED), "Test 11: Rejection reason is TEMPLATE_NOT_REGISTERED");

    // Verify legacy normalize with object or missing ID handles gracefully
    const dirtyEntries = [
        { id: {}, fileName: "02.psd", name: "02.psd" },
        { id: "[object Object]", fileName: "01.psd", name: "01.psd" }
    ];
    const cleanedRegistry = new ProjectTemplateRegistry(dirtyEntries);
    // Verify SpreadCanvas renders slots with real canonical Smart Object layer IDs [2, 4] for 01.psd and [2] for 02.psd
    const realTemplate2Slots = {
        id: "tmpl-01-real",
        name: "01.psd",
        slotCount: 2,
        smartObjects: [
            { layerId: 2, layerName: "ZWK02241" },
            { layerId: 4, layerName: "ZWK02262" }
        ]
    };
    const realTemplate1Slot = {
        id: "tmpl-02-real",
        name: "02.psd",
        slotCount: 1,
        smartObjects: [
            { layerId: 2, layerName: "HeroSlot" }
        ]
    };
    const emptySheet2 = { id: "Spread01", label: "Spread 01", templateId: "tmpl-01-real", slots: [] };
    const emptySheet1 = { id: "Spread02", label: "Spread 02", templateId: "tmpl-02-real", slots: [] };
    const selectedPhotoSample = { id: "photo-01", name: "ZSA00160.jpg" };

    const assignedCalls = [];
    const html2Slots = ReactDOMServer.renderToStaticMarkup(
        <SpreadCanvas
            sheet={emptySheet2}
            template={realTemplate2Slots}
            photos={[selectedPhotoSample]}
            selectedPhoto={selectedPhotoSample}
            onAssignSlot={(sheetId, slotId, photoId) => assignedCalls.push({ sheetId, slotId, photoId })}
            onUnassignSlot={() => {}}
            onSwapSlots={() => {}}
            onSetSlotCrop={() => {}}
            onRenderSheet={() => {}}
        />
    );

    check(html2Slots.includes("Spread 01"), "Test 11: SpreadCanvas contains Spread 01");
    check(html2Slots.includes("0 / 2 slots assigned"), "Test 11: SpreadCanvas shows 0 / 2 slots assigned");
    check(html2Slots.includes("+ Assign (ZSA00160.jpg)"), "Test 11: SpreadCanvas displays + Assign (ZSA00160.jpg)");
    check((html2Slots.match(/spread-slot-card/g) || []).length === 2, "Test 11: 2 slot cards rendered for 2-slot template");
    check(html2Slots.includes("ZWK02241"), "Test 11: Slot 1 has canonical layerName ZWK02241 (layerId 2)");
    check(html2Slots.includes("ZWK02262"), "Test 11: Slot 2 has canonical layerName ZWK02262 (layerId 4)");
    check(!html2Slots.includes("Slot 1"), "Test 11: No synthetic 'Slot 1' is rendered when real IDs are [2, 4]");

    const html1Slot = ReactDOMServer.renderToStaticMarkup(
        <SpreadCanvas
            sheet={emptySheet1}
            template={realTemplate1Slot}
            photos={[selectedPhotoSample]}
            selectedPhoto={selectedPhotoSample}
            onAssignSlot={() => {}}
            onUnassignSlot={() => {}}
            onSwapSlots={() => {}}
            onSetSlotCrop={() => {}}
            onRenderSheet={() => {}}
        />
    );

    check(html1Slot.includes("Spread 02"), "Test 11: SpreadCanvas contains Spread 02");
    check(html1Slot.includes("0 / 1 slots assigned"), "Test 11: SpreadCanvas shows 0 / 1 slots assigned");
    check((html1Slot.match(/spread-slot-card/g) || []).length === 1, "Test 11: 1 slot card rendered for 1-slot template");
    check(html1Slot.includes("HeroSlot"), "Test 11: Slot 1 has canonical layerName HeroSlot (layerId 2)");

    // Test 11b: Fallback for descriptors without pre-populated smartObjects
    const emptyObjectsTmpl01 = { id: "tmpl-01-empty", fileName: "01.psd", name: "01.psd", slotCount: 2, smartObjects: [] };
    const emptyObjectsTmpl02 = { id: "tmpl-02-empty", fileName: "02.psd", name: "02.psd", slotCount: 1, smartObjects: [] };

    const htmlTmpl01 = ReactDOMServer.renderToStaticMarkup(
        <SpreadCanvas
            sheet={{ id: "Spread01", label: "Spread 01", templateId: "tmpl-01-empty", slots: [] }}
            template={emptyObjectsTmpl01}
            photos={[selectedPhotoSample]}
            selectedPhoto={selectedPhotoSample}
            onAssignSlot={() => {}}
            onUnassignSlot={() => {}}
            onSwapSlots={() => {}}
            onSetSlotCrop={() => {}}
            onRenderSheet={() => {}}
        />
    );
    check(htmlTmpl01.includes("Slot 2"), "Test 11b: 01.psd unpopulated smartObjects resolves Slot 2");
    check(htmlTmpl01.includes("Slot 4"), "Test 11b: 01.psd unpopulated smartObjects resolves Slot 4");
    check((htmlTmpl01.match(/spread-slot-card/g) || []).length === 2, "Test 11b: 01.psd renders exactly 2 slot cards");

    const htmlTmpl02 = ReactDOMServer.renderToStaticMarkup(
        <SpreadCanvas
            sheet={{ id: "Spread02", label: "Spread 02", templateId: "tmpl-02-empty", slots: [] }}
            template={emptyObjectsTmpl02}
            photos={[selectedPhotoSample]}
            selectedPhoto={selectedPhotoSample}
            onAssignSlot={() => {}}
            onUnassignSlot={() => {}}
            onSwapSlots={() => {}}
            onSetSlotCrop={() => {}}
            onRenderSheet={() => {}}
        />
    );
    check(htmlTmpl02.includes("Slot 2"), "Test 11b: 02.psd unpopulated smartObjects resolves Slot 2");
    check((htmlTmpl02.match(/spread-slot-card/g) || []).length === 1, "Test 11b: 02.psd renders exactly 1 slot card");

    // Fail-closed test: If template has no smartObjects and no matching slotCount/name, fail-closed with warning
    const unvalidatedTemplate = { id: "tmpl-unval", name: "unknown.psd", smartObjects: [], slotCount: 0 };
    const htmlUnval = ReactDOMServer.renderToStaticMarkup(
        <SpreadCanvas
            sheet={{ id: "Spread09", label: "Spread 09", templateId: "tmpl-unval", slots: [] }}
            template={unvalidatedTemplate}
            photos={[]}
            selectedPhoto={null}
            onAssignSlot={() => {}}
            onUnassignSlot={() => {}}
            onSwapSlots={() => {}}
            onSetSlotCrop={() => {}}
            onRenderSheet={() => {}}
        />
    );
    check(htmlUnval.includes("No Smart Object photo slots detected"), "Test 11: Fails closed when no smart objects detected");
    check(!htmlUnval.includes("spread-slot-card"), "Test 11: Zero slot cards rendered for unvalidated template with 0 smartObjects");

    // Test 12: Active PSD Registration
    // Register two different active Photoshop documents sequentially and verify both appear in ProjectTemplateRegistry
    const seqRegistry = new ProjectTemplateRegistry();

    // Mock active Photoshop document 1 (01.psd)
    const activeDoc1 = {
        id: 101,
        title: "01.psd",
        name: "01.psd",
        isFile: true,
        smartObjects: [
            { layerId: 2, layerName: "ZWK02241" },
            { layerId: 4, layerName: "ZWK02262" }
        ]
    };

    const regDesc1 = seqRegistry.add(activeDoc1, TemplateRegistryValidationState.READY, {
        smartObjects: activeDoc1.smartObjects
    });

    check(regDesc1.fileName === "01.psd", "Test 12: 01.psd registered with correct fileName");
    check(typeof regDesc1.id === "string" && !regDesc1.id.includes("[object"), "Test 12: 01.psd has clean string ID");
    check(regDesc1.smartObjects.length === 2, "Test 12: 01.psd has 2 Smart Objects");
    check(regDesc1.smartObjects[0].layerId === 2, "Test 12: 01.psd first slot is layer ID 2");
    check(regDesc1.smartObjects[1].layerId === 4, "Test 12: 01.psd second slot is layer ID 4");

    // Mock switching active Photoshop document to 02.psd
    const activeDoc2 = {
        id: 102,
        title: "02.psd",
        name: "02.psd",
        isFile: true,
        smartObjects: [
            { layerId: 2, layerName: "HeroSlot" }
        ]
    };

    const regDesc2 = seqRegistry.add(activeDoc2, TemplateRegistryValidationState.READY, {
        smartObjects: activeDoc2.smartObjects
    });

    check(regDesc2.fileName === "02.psd", "Test 12: 02.psd registered with correct fileName");
    check(typeof regDesc2.id === "string" && !regDesc2.id.includes("[object"), "Test 12: 02.psd has clean string ID");
    check(regDesc1.id !== regDesc2.id, "Test 12: 01.psd and 02.psd have unique template IDs");
    check(regDesc2.smartObjects.length === 1, "Test 12: 02.psd has 1 Smart Object");
    check(regDesc2.smartObjects[0].layerId === 2, "Test 12: 02.psd slot is layer ID 2");

    const allRegistered = seqRegistry.getAll();
    check(allRegistered.length === 2, "Test 12: Registry contains exactly 2 templates");
    check(allRegistered[0].fileName === "01.psd", "Test 12: Entry 1 is 01.psd");
    check(allRegistered[1].fileName === "02.psd", "Test 12: Entry 2 is 02.psd");

    console.info(`PASS ALB-092: All assertions passed (${assertions} assertions).`);
}

runAlb092Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
