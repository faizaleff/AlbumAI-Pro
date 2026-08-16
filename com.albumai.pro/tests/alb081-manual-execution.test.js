import assert from "assert";
import fs from "fs";
import path from "path";

import ManualSheetExecutionPlan from "../src/project/ManualSheetExecutionPlan";
import { photoDecisionKey } from "../src/services/PhotoBrowserModel";
import ReplacementStep from "../src/placement/ReplacementStep";
import ReplacementStepExecutor from "../src/placement/ReplacementStepExecutor";
import ProjectExecutor from "../src/project/ProjectExecutor";
import BatchRecoverySnapshot, {
    BATCH_RECOVERY_SCHEMA_VERSION
} from "../src/project/BatchRecoverySnapshot";

let assertions = 0;

function test(name, callback) {
    callback();
    assertions += 1;
    console.info(`PASS ALB-081 Slice 5: ${name}`);
}

function photo(id, fileName) {
    return {
        id,
        name: fileName,
        file: { nativePath: `/private/photos/${fileName}`, name: fileName }
    };
}

function fixture() {
    const first = photo("photo-a", "a.jpg");
    const second = photo("photo-b", "b.jpg");
    const keyA = photoDecisionKey(first);
    const keyB = photoDecisionKey(second);
    return {
        project: { metadata: { id: "project-081" } },
        request: {
            projectId: "project-081",
            sheet: {
                id: "cover",
                templateId: "template-cover",
                design: {
                    schemaVersion: 1,
                    assignments: [
                        { slotLayerId: 202, photoKey: keyB, cropFocus: { x: 1, y: 0 } },
                        { slotLayerId: 101, photoKey: keyA, cropFocus: { x: 0.2, y: 0.8 } }
                    ]
                }
            },
            template: { id: "template-cover" }
        },
        template: {
            id: 77,
            projectTemplateId: "template-cover",
            document: { id: 77 },
            smartObjects: [
                { layerId: 202, layerName: "Detail" },
                { layerId: 101, layerName: "Hero" }
            ]
        },
        photos: [first, second],
        keyA,
        keyB
    };
}

test("builds deterministic manual steps from current opaque photos and slots", () => {
    const value = fixture();
    const plan = new ManualSheetExecutionPlan().build(value);
    assert.strictEqual(plan.statistics.mode, "MANUAL_SHEET_DESIGN");
    assert.deepStrictEqual(plan.steps.map(step => step.slotLayerId), [101, 202]);
    assert.deepStrictEqual(plan.steps.map(step => step.photoId), ["photo-a", "photo-b"]);
    assert.deepStrictEqual(plan.steps[0].cropFocus, { x: 0.2, y: 0.8 });
    assert.deepStrictEqual(plan.steps[1].cropFocus, { x: 1, y: 0 });
    assert(plan.steps.every(step => step.fitMode === "fill"));
    assert(Object.isFrozen(plan));
    assert(Object.isFrozen(plan.steps));
});

test("fails closed when a persisted assignment no longer resolves", () => {
    const missingPhoto = fixture();
    missingPhoto.photos = missingPhoto.photos.slice(1);
    assert.throws(
        () => new ManualSheetExecutionPlan().build(missingPhoto),
        /unavailable photo/
    );
    const missingSlot = fixture();
    missingSlot.template.smartObjects = missingSlot.template.smartObjects.slice(1);
    assert.throws(
        () => new ManualSheetExecutionPlan().build(missingSlot),
        /missing Smart Object slot/
    );
    const wrongTemplate = fixture();
    wrongTemplate.template.projectTemplateId = "other-template";
    assert.throws(
        () => new ManualSheetExecutionPlan().build(wrongTemplate),
        /active template/
    );
});

test("preserves valid crop focus in replacement steps and defaults malformed legacy values", () => {
    const base = {
        stepNumber: 1,
        slotLayerId: 101,
        photoId: "photo-a",
        photoFileReference: "a.jpg",
        expectedLayerType: "smartObject",
        expectedDocumentId: 77
    };
    assert.deepStrictEqual(new ReplacementStep({
        ...base,
        cropFocus: { x: 0.1, y: 0.9 }
    }).cropFocus, { x: 0.1, y: 0.9 });
    assert.deepStrictEqual(new ReplacementStep({
        ...base,
        cropFocus: { x: -1, y: 2 }
    }).cropFocus, { x: 0.5, y: 0.5 });
});

test("constrains crop offsets so a fill replacement continues covering the slot", () => {
    const executor = new ReplacementStepExecutor();
    const original = {
        left: 0, top: 0, right: 100, bottom: 100,
        width: 100, height: 100, centerX: 50, centerY: 50
    };
    const replacement = {
        left: 0, top: 0, right: 200, bottom: 200,
        width: 200, height: 200, centerX: 100, centerY: 100
    };
    assert.deepStrictEqual(executor.cropFocusOffset(original, replacement, { x: 0.5, y: 0.5 }), {
        offsetX: -50, offsetY: -50
    });
    assert.deepStrictEqual(executor.cropFocusOffset(original, replacement, { x: 0, y: 0 }), {
        offsetX: 0, offsetY: 0
    });
    assert.deepStrictEqual(executor.cropFocusOffset(original, replacement, { x: 1, y: 1 }), {
        offsetX: -100, offsetY: -100
    });
});

test("reports manual assignment steps instead of every available source photo", () => {
    const executor = Object.create(ProjectExecutor.prototype);
    const allocation = executor.allocationSnapshot({
        startCursor: 0,
        endCursor: 0,
        remainingPhotos: 3,
        photos: [photo("photo-a", "a.jpg"), photo("photo-b", "b.jpg")]
    }, "COMPLETED", [
        { photoId: "photo-b" },
        { photoId: "photo-b" }
    ]);
    assert.deepStrictEqual(allocation, {
        startCursor: 0,
        endCursor: 0,
        assignedCount: 2,
        assignedPhotoIds: ["photo-b", "photo-b"],
        remainingCount: 3,
        status: "COMPLETED",
        mode: "MANUAL_SHEET_DESIGN"
    });
});

test("persists a bounded manual Sheet identity for safe retry and resume", () => {
    const snapshot = new BatchRecoverySnapshot({
        projectId: "project-081",
        manualSheetId: "cover",
        runMode: "ALBUM_SHEET_RENDER"
    });
    assert.strictEqual(snapshot.schemaVersion, BATCH_RECOVERY_SCHEMA_VERSION);
    assert.strictEqual(snapshot.manualSheetId, "cover");
    assert(BatchRecoverySnapshot.validatePersisted(snapshot).valid);
    assert.strictEqual(
        BatchRecoverySnapshot.validatePersisted({
            schemaVersion: BATCH_RECOVERY_SCHEMA_VERSION,
            manualSheetId: ""
        }).valid,
        false
    );
});

test("routes a manual Sheet request through the guarded project executor path", () => {
    const root = process.cwd();
    const app = fs.readFileSync(path.join(root, "src/app/AppController.js"), "utf8");
    const executor = fs.readFileSync(path.join(root, "src/project/ProjectExecutor.js"), "utf8");
    const bridge = fs.readFileSync(path.join(root, "src/project/AlbumSheetRenderBridge.js"), "utf8");
    assert(app.includes("manualSheetRequest: validation.request"));
    assert(app.includes("projectTemplateId: descriptor.id"));
    assert(executor.includes("manualSheetExecutionPlan.build"));
    assert(executor.includes("manualSheetRequest = null"));
    assert(executor.includes("manualPhotoAllocation"));
    assert(executor.includes('mode: manual ? "MANUAL_SHEET_DESIGN" : "SELECTION"'));
    assert(app.includes("manualSheetRequestForRecovery(snapshot)"));
    assert(app.includes("manualSheetId: manualSheetRequest?.sheet?.id"));
    assert(bridge.includes("allowEmpty: sheet.design.assignments.length > 0"));
});

console.info(`ALB-081 Slice 5 execution tests passed: ${assertions}`);
