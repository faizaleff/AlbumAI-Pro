import assert from "assert";
import fs from "fs";
import path from "path";
import {
    AlbumSheetMutationIntent,
    applyAlbumSheetMutation,
    inspectAlbum
} from "../src/project/AlbumSheetSchema";
import { createAlbumSheetRenderRequest } from "../src/project/AlbumSheetRenderBridge";

const assignment = Object.freeze({
    layerId: 2,
    role: "TITLE",
    text: "Our Story",
    preset: null,
    placement: { anchor: "TOP_CENTER" }
});
const registry = [{
    id: "template-1",
    name: "01.psd",
    validationState: "READY",
    validationSchemaVersion: 1,
    smartObjects: [{ layerId: 4, layerName: "Photo" }]
}];

const initial = {
    schemaVersion: 1,
    sheets: [{ id: "sheet-1", templateId: "template-1", slots: [{ slotId: 4, photoId: "photo-1" }] }]
};

const saved = applyAlbumSheetMutation(initial, {
    intent: AlbumSheetMutationIntent.SET_TYPOGRAPHY,
    sheetId: "sheet-1",
    assignments: [assignment]
}, { templateIds: ["template-1"] });

assert.strictEqual(saved.accepted, true);
assert.strictEqual(saved.album.sheets[0].typographyAssignments[0].text, "Our Story");
assert(Object.isFrozen(saved.album.sheets[0].typographyAssignments));

const reopened = inspectAlbum(JSON.parse(JSON.stringify(saved.album)));
assert.strictEqual(reopened.valid, true);
assert.deepStrictEqual(reopened.album.sheets[0].typographyAssignments[0], assignment);

const request = createAlbumSheetRenderRequest({
    projectId: "project-1",
    album: reopened.album,
    registry,
    sheetId: "sheet-1",
    selectedPhotoIds: ["photo-1"]
});
assert.strictEqual(request.accepted, true);
assert.strictEqual(request.request.sheet.typographyAssignments[0].layerId, 2);
assert(Object.isFrozen(request.request.sheet.typographyAssignments));

const invalid = applyAlbumSheetMutation(reopened.album, {
    intent: AlbumSheetMutationIntent.SET_TYPOGRAPHY,
    sheetId: "sheet-1",
    assignments: [{ ...assignment, role: "UNKNOWN" }]
});
assert.strictEqual(invalid.accepted, false);

const executorSource = fs.readFileSync(path.join(process.cwd(), "src/project/ProjectExecutor.js"), "utf8");
assert(executorSource.indexOf('onStageProgress?.("TYPOGRAPHY")') < executorSource.indexOf('onStageProgress?.("SAVING")'));
assert(executorSource.includes("ALBUM_SHEET_TYPOGRAPHY_FAILED"));

console.info("PASS ALB-127: sheet typography persists, snapshots, validates, and executes before output");
