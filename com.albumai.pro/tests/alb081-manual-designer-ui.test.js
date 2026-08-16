import assert from "assert";
import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

import ManualDesignerPanel from "../src/components/ManualDesignerPanel";
import {
    buildManualDesignerView,
    manualDesignerClearMutation,
    manualDesignerCropMutation,
    manualDesignerDropMutation,
    ManualDesignerDragKind,
    ManualDesignerStatus,
    MAX_MANUAL_DESIGNER_PHOTOS
} from "../src/components/manualDesignerModel";
import { ManualSheetDesignIntent } from "../src/project/ManualSheetDesign";
import Template from "../src/templates/Template";

const PHOTO_A = "p1-0123456789abcdef";
let assertions = 0;

function test(name, callback) {
    callback();
    assertions += 1;
    console.info(`PASS ALB-081 Designer UI: ${name}`);
}

function photo(index) {
    return {
        id: `/private/photos/photo-${index}.jpg`,
        name: `photo-${index}.jpg`
    };
}

function fixture(overrides = {}) {
    return {
        sheet: {
            id: "cover",
            label: "Cover",
            templateId: "registered-cover",
            design: { schemaVersion: 1, assignments: [] }
        },
        templates: [{
            id: "registered-cover",
            name: "Cover.psd",
            validationState: "READY"
        }],
        activeTemplate: {
            projectTemplateId: "registered-cover",
            smartObjects: [{
                layerId: 101,
                layerName: "Hero photo",
                bounds: { left: 0, top: 0, right: 800, bottom: 600 }
            }]
        },
        photos: [photo(1)],
        ...overrides
    };
}

test("keeps the designer closed until a Sheet is selected", () => {
    const view = buildManualDesignerView(fixture({ sheet: null }));
    assert.strictEqual(view.status, ManualDesignerStatus.NO_SHEET);
    assert.strictEqual(view.sheet, null);
});

test("distinguishes missing and not-yet-loaded templates", () => {
    const missing = buildManualDesignerView(fixture({ templates: [] }));
    assert.strictEqual(missing.status, ManualDesignerStatus.TEMPLATE_MISSING);
    const unloaded = buildManualDesignerView(fixture({ activeTemplate: null }));
    assert.strictEqual(unloaded.status, ManualDesignerStatus.TEMPLATE_NOT_LOADED);
});

test("renders a bounded load-slots state for the selected Sheet", () => {
    const value = fixture({ activeTemplate: null });
    const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ManualDesignerPanel, value)
    );
    assert(markup.includes("Manual Designer"));
    assert(markup.includes("Load slots"));
    assert(markup.includes("Cover.psd"));
});

test("exposes deterministic Smart Object slot and assignment states", () => {
    const source = fixture();
    const actualKey = buildManualDesignerView(source).photos.items[0].photoKey;
    source.sheet.design.assignments = [{
        slotLayerId: 101,
        photoKey: actualKey,
        cropFocus: { x: 0.25, y: 0.75 }
    }];
    source.activeTemplate.smartObjects.push({
        layerId: 202,
        layerName: "Detail photo",
        bounds: null
    });
    const view = buildManualDesignerView(source);
    assert.strictEqual(view.status, ManualDesignerStatus.READY);
    assert.strictEqual(view.slots.length, 2);
    assert.strictEqual(view.assignedCount, 1);
    assert.strictEqual(view.slots[0].assigned, true);
    assert.strictEqual(view.slots[0].photoAvailable, true);
    assert.deepStrictEqual(view.slots[0].cropFocus, { x: 0.25, y: 0.75 });
    assert.strictEqual(view.slots[1].assigned, false);
});

test("reports a loaded template without usable Smart Objects", () => {
    const view = buildManualDesignerView(fixture({
        activeTemplate: {
            projectTemplateId: "registered-cover",
            smartObjects: [{ layerId: null }, { layerId: -1 }]
        }
    }));
    assert.strictEqual(view.status, ManualDesignerStatus.NO_SLOTS);
});

test("bounds the photo tray and marks assigned photos", () => {
    const photos = Array.from(
        { length: MAX_MANUAL_DESIGNER_PHOTOS + 5 },
        (_, index) => photo(index + 1)
    );
    const base = buildManualDesignerView(fixture({ photos }));
    const assignedKey = base.photos.items[0].photoKey;
    const value = fixture({ photos });
    value.sheet.design.assignments = [{
        slotLayerId: 101,
        photoKey: assignedKey,
        cropFocus: { x: 0.5, y: 0.5 }
    }];
    const view = buildManualDesignerView(value);
    assert.strictEqual(view.photos.items.length, MAX_MANUAL_DESIGNER_PHOTOS);
    assert.strictEqual(view.photos.hidden, 5);
    assert.strictEqual(view.photos.items[0].assignedSlotLayerId, 101);
});

test("keeps paths and live photo objects outside the detached view model", () => {
    const view = buildManualDesignerView(fixture());
    const serialized = JSON.stringify(view);
    assert(!serialized.includes("/private/photos"));
    assert(!serialized.includes("nativePath"));
    assert(/^p1-[0-9a-f]{16}$/.test(view.photos.items[0].photoKey));
    assert(Object.isFrozen(view));
    assert(Object.isFrozen(view.slots));
});

test("retains the registered-template identity on the in-memory PSD model", () => {
    const template = new Template({
        documentId: 42,
        projectTemplateId: "registered-cover",
        smartObjects: []
    });
    assert.strictEqual(template.projectTemplateId, "registered-cover");
    assert(Object.isFrozen(template));
});

test("maps photo drops to bounded assignment commands", () => {
    const mutation = manualDesignerDropMutation({
        kind: ManualDesignerDragKind.PHOTO,
        photoKey: PHOTO_A
    }, 101);
    assert.deepStrictEqual(mutation, {
        intent: ManualSheetDesignIntent.ASSIGN_PHOTO,
        slotLayerId: 101,
        photoKey: PHOTO_A
    });
    assert(Object.isFrozen(mutation));
});

test("maps slot drops to swap or move commands and ignores self-drops", () => {
    const mutation = manualDesignerDropMutation({
        kind: ManualDesignerDragKind.SLOT,
        slotLayerId: 101
    }, 202);
    assert.deepStrictEqual(mutation, {
        intent: ManualSheetDesignIntent.SWAP_SLOTS,
        slotLayerId: 101,
        targetSlotLayerId: 202
    });
    assert.strictEqual(manualDesignerDropMutation({
        kind: ManualDesignerDragKind.SLOT,
        slotLayerId: 101
    }, 101), null);
});

test("maps clear controls to bounded clear-slot commands", () => {
    assert.deepStrictEqual(manualDesignerClearMutation(101), {
        intent: ManualSheetDesignIntent.CLEAR_SLOT,
        slotLayerId: 101
    });
    assert.strictEqual(manualDesignerClearMutation(-1), null);
});

test("rejects malformed drag payloads before they reach persistence", () => {
    assert.strictEqual(manualDesignerDropMutation({
        kind: ManualDesignerDragKind.PHOTO,
        photoKey: "/private/photo.jpg"
    }, 101), null);
    assert.strictEqual(manualDesignerDropMutation({
        kind: ManualDesignerDragKind.SLOT,
        slotLayerId: "101"
    }, 202), null);
    assert.strictEqual(manualDesignerDropMutation(null, 101), null);
});

test("maps crop drafts to normalized explicit persistence commands", () => {
    const mutation = manualDesignerCropMutation(101, {
        x: 0.123456789,
        y: "0.75"
    });
    assert.deepStrictEqual(mutation, {
        intent: ManualSheetDesignIntent.SET_CROP_FOCUS,
        slotLayerId: 101,
        cropFocus: { x: 0.123457, y: 0.75 }
    });
    assert(Object.isFrozen(mutation));
    assert(Object.isFrozen(mutation.cropFocus));
});

test("rejects invalid crop drafts before persistence", () => {
    assert.strictEqual(manualDesignerCropMutation(0, { x: 0.5, y: 0.5 }), null);
    assert.strictEqual(manualDesignerCropMutation(101, { x: -0.1, y: 0.5 }), null);
    assert.strictEqual(manualDesignerCropMutation(101, { x: 0.5, y: 1.1 }), null);
    assert.strictEqual(manualDesignerCropMutation(101, { x: "bad", y: 0.5 }), null);
});

test("wires template switching and registered-template slot loading into the Sheet editor", () => {
    const root = process.cwd();
    const openFolder = fs.readFileSync(
        path.join(root, "src/components/OpenFolder.jsx"),
        "utf8"
    );
    const controller = fs.readFileSync(
        path.join(root, "src/app/AppController.js"),
        "utf8"
    );
    assert(openFolder.includes("<ManualDesignerPanel"));
    assert(openFolder.includes("AlbumSheetMutationIntent.SET_TEMPLATE"));
    assert(openFolder.includes("App.openRegisteredProjectTemplate(templateId)"));
    assert(openFolder.includes("AlbumSheetMutationIntent.EDIT_DESIGN"));
    assert(openFolder.includes("onDesignMutation={editSelectedAlbumDesign}"));
    assert(controller.includes("async openRegisteredProjectTemplate(id)"));
    assert(controller.includes("resolveRegisteredTemplate"));
    assert(controller.includes("options.slotLayerIds"));
    assert(controller.includes("options.photoKeys"));
});

test("wires click, drag, keyboard clear, and swap controls into the panel", () => {
    const source = fs.readFileSync(
        path.join(process.cwd(), "src/components/ManualDesignerPanel.jsx"),
        "utf8"
    );
    assert(source.includes("onDragStart"));
    assert(source.includes("onDrop"));
    assert(source.includes('event.key === "Escape"'));
    assert(source.includes('["Delete", "Backspace"]'));
    assert(source.includes("ManualDesignerDragKind.SLOT"));
    assert(source.includes("manualDesignerClearMutation"));
});

test("wires draft-only crop sliders, presets, preview, revert, and explicit apply", () => {
    const source = fs.readFileSync(
        path.join(process.cwd(), "src/components/ManualDesignerPanel.jsx"),
        "utf8"
    );
    assert(source.includes('type="range"'));
    assert(source.includes("objectPosition"));
    assert(source.includes("manual-designer-crop-marker"));
    assert(source.includes('["Center", 0.5, 0.5]'));
    assert(source.includes("Revert"));
    assert(source.includes("Apply crop focus"));
    assert(source.includes("manualDesignerCropMutation"));
    assert(source.includes("{ clearSlot: false }"));
});

console.info(`ALB-081 Designer UI tests passed: ${assertions}`);
