import assert from "assert";

import {
    ALBUM_SCHEMA_VERSION,
    AlbumSheetMutationIntent,
    applyAlbumSheetHistoryMutation,
    applyAlbumSheetMutation,
    createAlbumSheetHistory,
    inspectAlbum,
    migrateAlbum,
    redoAlbumSheetHistory,
    undoAlbumSheetHistory
} from "../src/project/AlbumSheetSchema";
import {
    AlbumSheetRenderReason,
    createAlbumSheetRenderRequest,
    validateAlbumSheetRenderRequest
} from "../src/project/AlbumSheetRenderBridge";
import {
    ManualSheetDesignIntent,
    ManualSheetDesignMutationReason,
    ManualSheetDesignReason,
    applyManualSheetDesignMutation,
    createEmptyManualSheetDesign,
    inspectManualSheetDesign
} from "../src/project/ManualSheetDesign";
import ProjectService, { PROJECT_SCHEMA_VERSION } from "../src/services/ProjectService";
import ProjectEngine from "../src/core/ProjectEngine";

const PHOTO_A = "p1-0123456789abcdef";
const PHOTO_B = "p1-fedcba9876543210";
const CONTEXT = Object.freeze({
    slotLayerIds: Object.freeze([101, 202, 303]),
    photoKeys: Object.freeze([PHOTO_A, PHOTO_B])
});

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-081 Slice 1: ${name}`);
}

function sheetAlbum() {
    return inspectAlbum({
        schemaVersion: ALBUM_SCHEMA_VERSION,
        sheets: [{ id: "cover", templateId: "template-cover" }]
    }).album;
}

function service() {
    return new ProjectService({
        projectEngine: new ProjectEngine(),
        recentProjects: { add() {}, getAll: () => [] }
    });
}

async function run() {
    await test("defines an empty frozen manual-design contract", () => {
        const design = createEmptyManualSheetDesign();
        assert.deepStrictEqual(design, { schemaVersion: 1, assignments: [] });
        assert(Object.isFrozen(design));
        assert(Object.isFrozen(design.assignments));
        assert.strictEqual(inspectManualSheetDesign(design).valid, true);
    });

    await test("rejects unsafe, duplicate, and malformed persisted assignments", () => {
        const unsafe = inspectManualSheetDesign({
            schemaVersion: 1,
            assignments: [{
                slotLayerId: 101,
                photoKey: "/Users/name/photo.jpg",
                cropFocus: { x: 0.5, y: 0.5 }
            }]
        });
        assert.deepStrictEqual(unsafe.reasonCodes, [ManualSheetDesignReason.INVALID_PHOTO_KEY]);

        const duplicate = inspectManualSheetDesign({
            schemaVersion: 1,
            assignments: [
                { slotLayerId: 101, photoKey: PHOTO_A, cropFocus: { x: 0.5, y: 0.5 } },
                { slotLayerId: 101, photoKey: PHOTO_B, cropFocus: { x: 0.5, y: 0.5 } }
            ]
        });
        assert.deepStrictEqual(duplicate.reasonCodes, [ManualSheetDesignReason.DUPLICATE_SLOT]);
    });

    await test("assigns only current opaque photos to current Smart Object slots", () => {
        const initial = createEmptyManualSheetDesign();
        const rejectedSlot = applyManualSheetDesignMutation(initial, {
            intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
            slotLayerId: 999,
            photoKey: PHOTO_A
        }, CONTEXT);
        assert.deepStrictEqual(rejectedSlot.reasonCodes, [
            ManualSheetDesignMutationReason.SLOT_NOT_AVAILABLE
        ]);

        const assigned = applyManualSheetDesignMutation(initial, {
            intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
            slotLayerId: 202,
            photoKey: PHOTO_A
        }, CONTEXT);
        assert.strictEqual(assigned.accepted, true);
        assert.deepStrictEqual(assigned.design.assignments, [{
            slotLayerId: 202,
            photoKey: PHOTO_A,
            cropFocus: { x: 0.5, y: 0.5 }
        }]);
        assert.deepStrictEqual(initial.assignments, []);
    });

    await test("keeps deterministic slot order independent of command order", () => {
        let design = createEmptyManualSheetDesign();
        design = applyManualSheetDesignMutation(design, {
            intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
            slotLayerId: 303,
            photoKey: PHOTO_A
        }, CONTEXT).design;
        design = applyManualSheetDesignMutation(design, {
            intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
            slotLayerId: 101,
            photoKey: PHOTO_B
        }, CONTEXT).design;
        assert.deepStrictEqual(
            design.assignments.map(item => item.slotLayerId),
            [101, 303]
        );
    });

    await test("swaps assignments with their crop focus and moves into an empty slot", () => {
        const seeded = {
            schemaVersion: 1,
            assignments: [
                { slotLayerId: 101, photoKey: PHOTO_A, cropFocus: { x: 0.2, y: 0.3 } },
                { slotLayerId: 202, photoKey: PHOTO_B, cropFocus: { x: 0.8, y: 0.7 } }
            ]
        };
        const swapped = applyManualSheetDesignMutation(seeded, {
            intent: ManualSheetDesignIntent.SWAP_SLOTS,
            slotLayerId: 101,
            targetSlotLayerId: 202
        }, CONTEXT);
        assert.strictEqual(swapped.design.assignments[0].photoKey, PHOTO_B);
        assert.deepStrictEqual(swapped.design.assignments[0].cropFocus, { x: 0.8, y: 0.7 });

        const moved = applyManualSheetDesignMutation(swapped.design, {
            intent: ManualSheetDesignIntent.SWAP_SLOTS,
            slotLayerId: 202,
            targetSlotLayerId: 303
        }, CONTEXT);
        assert.deepStrictEqual(
            moved.design.assignments.map(item => item.slotLayerId),
            [101, 303]
        );
    });

    await test("normalizes bounded crop focus and rejects invalid values", () => {
        const assigned = applyManualSheetDesignMutation(
            createEmptyManualSheetDesign(),
            {
                intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
                slotLayerId: 101,
                photoKey: PHOTO_A
            },
            CONTEXT
        ).design;
        const focused = applyManualSheetDesignMutation(assigned, {
            intent: ManualSheetDesignIntent.SET_CROP_FOCUS,
            slotLayerId: 101,
            cropFocus: { x: 0.123456789, y: 1 }
        }, CONTEXT);
        assert.deepStrictEqual(focused.design.assignments[0].cropFocus, {
            x: 0.123457,
            y: 1
        });
        const rejected = applyManualSheetDesignMutation(focused.design, {
            intent: ManualSheetDesignIntent.SET_CROP_FOCUS,
            slotLayerId: 101,
            cropFocus: { x: -0.1, y: 0.5 }
        }, CONTEXT);
        assert.deepStrictEqual(rejected.reasonCodes, [
            ManualSheetDesignMutationReason.INVALID_CROP_FOCUS
        ]);
    });

    await test("clears assignments without recording a false change", () => {
        const empty = createEmptyManualSheetDesign();
        const unchanged = applyManualSheetDesignMutation(empty, {
            intent: ManualSheetDesignIntent.CLEAR_SLOT,
            slotLayerId: 101
        }, CONTEXT);
        assert.strictEqual(unchanged.changed, false);
        assert.deepStrictEqual(unchanged.reasonCodes, [ManualSheetDesignMutationReason.NO_CHANGE]);
    });

    await test("resets stale slot assignments when the Sheet template changes", () => {
        let album = sheetAlbum();
        album = applyAlbumSheetMutation(album, {
            intent: AlbumSheetMutationIntent.EDIT_DESIGN,
            sheetId: "cover",
            designMutation: {
                intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
                slotLayerId: 101,
                photoKey: PHOTO_A
            }
        }, CONTEXT).album;
        assert.strictEqual(album.sheets[0].design.assignments.length, 1);

        const changed = applyAlbumSheetMutation(album, {
            intent: AlbumSheetMutationIntent.SET_TEMPLATE,
            sheetId: "cover",
            templateId: "template-spread"
        }, { templateIds: ["template-cover", "template-spread"] });
        assert.strictEqual(changed.album.sheets[0].templateId, "template-spread");
        assert.deepStrictEqual(changed.album.sheets[0].design.assignments, []);
    });

    await test("includes manual edits in bounded Album undo and redo", () => {
        const history = createAlbumSheetHistory(sheetAlbum());
        const edited = applyAlbumSheetHistoryMutation(history, {
            intent: AlbumSheetMutationIntent.EDIT_DESIGN,
            sheetId: "cover",
            designMutation: {
                intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
                slotLayerId: 101,
                photoKey: PHOTO_A
            }
        }, CONTEXT);
        assert.strictEqual(edited.history.present.sheets[0].design.assignments.length, 1);
        const undone = undoAlbumSheetHistory(edited.history);
        assert.deepStrictEqual(undone.history.present.sheets[0].design.assignments, []);
        const redone = redoAlbumSheetHistory(undone.history);
        assert.strictEqual(redone.history.present.sheets[0].design.assignments.length, 1);
    });

    await test("rejects a render request after manual Sheet design changes", () => {
        const album = sheetAlbum();
        const registry = [{
            id: "template-cover",
            registrationOrder: 0,
            validationState: "READY",
            validationReason: "READY",
            validationSchemaVersion: 1
        }];
        const request = createAlbumSheetRenderRequest({
            projectId: "project-081",
            album,
            registry,
            sheetId: "cover",
            selectedPhotoIds: ["photo-1"]
        }).request;
        const edited = applyAlbumSheetMutation(album, {
            intent: AlbumSheetMutationIntent.EDIT_DESIGN,
            sheetId: "cover",
            designMutation: {
                intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
                slotLayerId: 101,
                photoKey: PHOTO_A
            }
        }, CONTEXT).album;
        const validation = validateAlbumSheetRenderRequest(request, {
            projectId: "project-081",
            album: edited,
            registry,
            selectedPhotoIds: ["photo-1"]
        });
        assert.strictEqual(validation.accepted, false);
        assert.deepStrictEqual(validation.reasonCodes, [AlbumSheetRenderReason.SHEET_STALE]);
    });

    await test("migrates legacy Album schema without inventing assignments", () => {
        const migrated = migrateAlbum({
            schemaVersion: 1,
            sheets: [{ id: "cover", templateId: "template-cover", label: "Cover" }]
        });
        assert.strictEqual(migrated.valid, true);
        assert.strictEqual(migrated.migrated, true);
        assert.strictEqual(migrated.album.schemaVersion, ALBUM_SCHEMA_VERSION);
        assert.deepStrictEqual(migrated.album.sheets[0].design.assignments, []);

        const metadata = service().migrateMetadata({
            id: "project-081",
            name: "Manual designer fixture",
            schemaVersion: PROJECT_SCHEMA_VERSION,
            album: {
                schemaVersion: 1,
                sheets: [{ id: "cover", templateId: "template-cover" }]
            }
        });
        assert.strictEqual(metadata.migrated, true);
        assert.strictEqual(metadata.migrationReason, "MIGRATE_ALBUM_SCHEMA_V1_TO_V2");
        assert.deepStrictEqual(metadata.metadata.album.sheets[0].design.assignments, []);
    });

    console.info(`ALB-081 Slice 1: PASS (${assertions} assertions)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
