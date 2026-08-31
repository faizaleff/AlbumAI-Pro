import assert from "assert";
import fs from "fs";
import path from "path";
import {
    AlbumSheetRenderReason,
    createAlbumBatchRenderRequest,
    createAlbumSheetRenderRequest,
    validateAlbumBatchRenderRequest,
    validateAlbumSheetRenderRequest
} from "../src/project/AlbumSheetRenderBridge";
import {
    AlbumSheetMutationIntent,
    applyAlbumSheetMutation,
    inspectAlbum
} from "../src/project/AlbumSheetSchema";
import { createManualTypographyDrafts } from "../src/components/ManualTypographyPanel";
import { typographyFailureMessage } from "../src/typography/TypographyAssignmentIntent";

const title = text => ({
    layerId: 2,
    role: "TITLE",
    text,
    preset: {
        fontFamily: "ArialNarrow",
        fontSize: 150,
        alignment: "center",
        color: { red: 10, green: 20, blue: 30 }
    },
    placement: { anchor: "TOP_CENTER" }
});

const registry = [{
    id: "template-1",
    name: "01.psd",
    validationState: "READY",
    validationSchemaVersion: 1,
    smartObjects: [{ layerId: 4, layerName: "Photo" }]
}];

const album = text => ({
    schemaVersion: 1,
    sheets: [
        {
            id: "sheet-1",
            templateId: "template-1",
            slots: [{ slotId: 4, photoId: "photo-1" }],
            typographyAssignments: [title(text)]
        },
        {
            id: "sheet-2",
            templateId: "template-1",
            slots: [{ slotId: 4, photoId: "photo-2" }],
            typographyAssignments: [title(`${text} Two`)]
        }
    ]
});

const original = album("Original");
const created = createAlbumSheetRenderRequest({
    projectId: "project-1",
    album: original,
    registry,
    sheetId: "sheet-1",
    selectedPhotoIds: []
});

assert.strictEqual(created.accepted, true);
const snapshotted = created.request.sheet.typographyAssignments[0];
assert(Object.isFrozen(created.request.sheet.typographyAssignments));
assert(Object.isFrozen(snapshotted));
assert(Object.isFrozen(snapshotted.preset));
assert(Object.isFrozen(snapshotted.preset.color));
assert(Object.isFrozen(snapshotted.placement));

const stale = validateAlbumSheetRenderRequest(created.request, {
    projectId: "project-1",
    album: album("Changed after request creation"),
    registry,
    selectedPhotoIds: []
});
assert.strictEqual(stale.accepted, false);
assert(stale.reasonCodes.includes(AlbumSheetRenderReason.SHEET_STALE));

const current = validateAlbumSheetRenderRequest(created.request, {
    projectId: "project-1",
    album: original,
    registry,
    selectedPhotoIds: []
});
assert.strictEqual(current.accepted, true);

const batch = createAlbumBatchRenderRequest({
    projectId: "project-1",
    album: original,
    registry,
    selectedPhotoIds: []
});
assert.strictEqual(batch.accepted, true);
assert.strictEqual(batch.request.sheetRequests.length, 2);
assert.strictEqual(batch.request.sheetRequests[0].sheet.typographyAssignments[0].text, "Original");
assert.strictEqual(batch.request.sheetRequests[1].sheet.typographyAssignments[0].text, "Original Two");
assert.notStrictEqual(
    batch.request.sheetRequests[0].sheet.typographyAssignments,
    batch.request.sheetRequests[1].sheet.typographyAssignments
);

const sharedTemplateLayers = [{
    layerId: 2,
    layerName: "TITLE",
    textContent: "Template title",
    visible: true,
    locked: false
}];
const firstSheetDraft = createManualTypographyDrafts(
    sharedTemplateLayers,
    original.sheets[0].typographyAssignments
)[0];
const secondSheetDraft = createManualTypographyDrafts(
    sharedTemplateLayers,
    original.sheets[1].typographyAssignments
)[0];
assert.strictEqual(firstSheetDraft.role, "TITLE");
assert.strictEqual(firstSheetDraft.text, "Original");
assert.strictEqual(secondSheetDraft.role, "TITLE");
assert.strictEqual(secondSheetDraft.text, "Original Two");
assert.deepStrictEqual(firstSheetDraft.placementAnchor, "TOP_CENTER");
assert.deepStrictEqual(firstSheetDraft.preset.color, { red: 10, green: 20, blue: 30 });

const staleBatch = validateAlbumBatchRenderRequest(batch.request, {
    projectId: "project-1",
    album: {
        ...original,
        sheets: [original.sheets[0], {
            ...original.sheets[1],
            typographyAssignments: [title("Second sheet changed")]
        }]
    },
    registry,
    selectedPhotoIds: []
});
assert.strictEqual(staleBatch.accepted, false);
assert(staleBatch.reasonCodes.includes(AlbumSheetRenderReason.SHEET_STALE));

const executorSource = fs.readFileSync(path.join(process.cwd(), "src/project/ProjectExecutor.js"), "utf8");
assert(executorSource.includes("No Smart Object slots; skipped."));
assert(executorSource.includes("template?.smartObjects?.some"));
const replacementBoundary = executorSource.indexOf('cancelledAtStage: "REPLACING"');
const typographyCall = executorSource.indexOf("typographyResult = await this.manualTypographyWorkflow.execute");
const typographyBoundary = executorSource.indexOf('cancelledAtStage: "TYPOGRAPHY"');
const saveStage = executorSource.indexOf('onStageProgress?.("SAVING")');
assert(replacementBoundary > 0 && replacementBoundary < typographyCall);
assert(typographyBoundary > typographyCall && typographyBoundary < saveStage);

const unicodeText = "ഞങ്ങളുടെ കഥ\nഒരുമിച്ച് ആരംഭിച്ച യാത്ര";
const unicodeAlbum = album(unicodeText);
const inspectedUnicode = inspectAlbum(JSON.parse(JSON.stringify(unicodeAlbum)));
assert.strictEqual(inspectedUnicode.valid, true);
assert.strictEqual(inspectedUnicode.album.sheets[0].typographyAssignments[0].text, unicodeText);

const rejectedDuplicate = applyAlbumSheetMutation(original, {
    intent: AlbumSheetMutationIntent.SET_TYPOGRAPHY,
    sheetId: "sheet-1",
    assignments: [title("One"), { ...title("Two"), layerId: "2" }]
});
assert.strictEqual(rejectedDuplicate.accepted, false);

const rejectedLongText = applyAlbumSheetMutation(original, {
    intent: AlbumSheetMutationIntent.SET_TYPOGRAPHY,
    sheetId: "sheet-1",
    assignments: [title("x".repeat(2001))]
});
assert.strictEqual(rejectedLongText.accepted, false);

const rejectedPlacement = applyAlbumSheetMutation(original, {
    intent: AlbumSheetMutationIntent.SET_TYPOGRAPHY,
    sheetId: "sheet-1",
    assignments: [{ ...title("Unsafe placement"), placement: { anchor: "CENTER" } }]
});
assert.strictEqual(rejectedPlacement.accepted, false);

const rejectedPreset = applyAlbumSheetMutation(original, {
    intent: AlbumSheetMutationIntent.SET_TYPOGRAPHY,
    sheetId: "sheet-1",
    assignments: [{ ...title("Unsafe preset"), preset: { fontSize: 1001 } }]
});
assert.strictEqual(rejectedPreset.accepted, false);

assert(typographyFailureMessage("TARGET_NOT_EDITABLE", 22).includes("hidden or locked"));
assert(typographyFailureMessage("TARGET_NOT_EDITABLE", 22).includes("22"));
assert(typographyFailureMessage("FONT_UNAVAILABLE").includes("not installed"));
assert(!typographyFailureMessage("FONT_UNAVAILABLE").includes("FONT_UNAVAILABLE"));
assert(typographyFailureMessage("UNKNOWN_REASON").includes("safely"));

const panelSource = fs.readFileSync(path.join(process.cwd(), "src/components/ManualTypographyPanel.jsx"), "utf8");
assert(panelSource.includes("Locked — unlock it in Photoshop."));
assert(panelSource.includes("Hidden — show it in Photoshop."));
assert(panelSource.includes("<textarea"));

const templatePanelSource = fs.readFileSync(path.join(process.cwd(), "src/components/TemplateDocumentPanel.jsx"), "utf8");
assert(templatePanelSource.includes("result?.document"));
const openFolderSource = fs.readFileSync(path.join(process.cwd(), "src/components/OpenFolder.jsx"), "utf8");
assert(openFolderSource.includes("activeSheet.typographyAssignments || []"));
assert(openFolderSource.includes("!updatedLayerIds.includes"));
assert(openFolderSource.includes("runRecovery(update => App.retryFailedTemplates(update), onUpdate)"));
assert(openFolderSource.includes("forceRefresh(value => value + 1)"));
const controllerSource = fs.readFileSync(path.join(process.cwd(), "src/app/AppController.js"), "utf8");
assert(controllerSource.includes("initialCompletedTemplates = resumeSnapshot?.successfulTemplateIds?.length || 0"));
assert(controllerSource.includes("initialFailedTemplates = 0"));
const adapterSource = fs.readFileSync(path.join(process.cwd(), "src/typography/PhotoshopTypographyAdapter.js"), "utf8");
assert(adapterSource.includes("failedLayerId ??= error?.layerId"));

console.info("PASS ALB-128: typography is deep, stale-safe, sheet-isolated, and cancellation-bounded");
