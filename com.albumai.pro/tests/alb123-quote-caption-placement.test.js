import assert from "assert";
import fs from "fs";
import path from "path";

import {
    createTypographyInventory,
    createTypographyPlan,
    TypographyPlacementAnchor,
    TypographyReason,
    TypographyState
} from "../src/typography/TypographyPlan";
import PhotoshopTypographyAdapter, {
    TypographyExecutionReason,
    TypographyExecutionStatus
} from "../src/typography/PhotoshopTypographyAdapter";
import {
    buildManualTypographyAssignments,
    createManualTypographyDrafts
} from "../src/components/ManualTypographyPanel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-123: ${name}`);
}

function descriptor(layerId) {
    return {
        layerId,
        layerName: `Text ${layerId}`,
        layerType: "textLayer",
        textContent: `Original ${layerId}`,
        visible: true,
        locked: false,
        bounds: { left: 100, top: 100, right: 300, bottom: 150 }
    };
}

function adapterSetup({ translate = true, rejectTranslation = false, width = 1000, height = 600 } = {}) {
    const state = {
        bounds: { left: 100, top: 100, right: 300, bottom: 150 },
        translations: [],
        resumed: [],
        activatedLayerIds: [],
        modalCalls: 0
    };
    let contents = "Original";
    const photoshopLayer = {
        id: 7,
        textItem: {
            characterStyle: {},
            paragraphStyle: {},
            get contents() { return contents; },
            set contents(value) { contents = value; }
        },
        get bounds() { return { ...state.bounds }; }
    };
    if (translate) {
        photoshopLayer.translate = async (horizontal, vertical) => {
            state.translations.push({ horizontal, vertical });
            if (rejectTranslation) throw new Error("Photoshop rejected translation");
            const horizontalValue = horizontal?._value ?? horizontal;
            const verticalValue = vertical?._value ?? vertical;
            state.bounds = {
                left: state.bounds.left + horizontalValue,
                top: state.bounds.top + verticalValue,
                right: state.bounds.right + horizontalValue,
                bottom: state.bounds.bottom + verticalValue
            };
        };
    }
    const runtimeLayer = {
        id: 7,
        kind: "textLayer",
        visible: true,
        locked: false,
        bounds: { ...state.bounds },
        photoshopLayer
    };
    const document = { id: 41, width, height };
    let activeLayers = [];
    Object.defineProperty(document, "activeLayers", {
        get() { return activeLayers; },
        set(layers) {
            activeLayers = layers;
            state.activatedLayerIds.push(...layers.map(layer => layer.id));
        }
    });
    const adapter = new PhotoshopTypographyAdapter({
        documentManager: {
            byId(id) { return id === 41 ? document : null; },
            get activeId() { return 41; },
            async activate() {}
        },
        layerManager: {
            scan() {},
            byId(id) { return id === 7 ? runtimeLayer : null; }
        },
        executeModal: {
            async run(callback) {
                state.modalCalls += 1;
                return callback({
                    hostControl: {
                        async suspendHistory() { return "history-1"; },
                        async resumeHistory(id, commit) { state.resumed.push({ id, commit }); }
                    }
                });
            }
        },
        fontCatalog: { async hasExact() { return true; } }
    });
    return { adapter, state };
}

function readyPlan(anchor) {
    return {
        schemaVersion: 1,
        templateId: "fixture",
        state: "READY",
        reasonCodes: [],
        steps: [{
            layerId: 7,
            role: "CAPTION",
            text: "Placed caption",
            preset: null,
            placement: { anchor }
        }]
    };
}

async function run() {
    await test("validates explicit anchors and rejects unknown placement data", () => {
        const inventory = createTypographyInventory([descriptor(7)]);
        const plan = createTypographyPlan({
            templateId: "fixture",
            inventory,
            assignments: [{
                layerId: 7,
                role: "CAPTION",
                text: "Caption",
                placement: { anchor: TypographyPlacementAnchor.BOTTOM_CENTER }
            }]
        });
        assert.strictEqual(plan.state, TypographyState.READY);
        assert.deepStrictEqual(plan.steps[0].placement, { anchor: "BOTTOM_CENTER" });

        const blocked = createTypographyPlan({
            templateId: "fixture",
            inventory,
            assignments: [{
                layerId: 7,
                role: "QUOTE",
                text: "Quote",
                placement: { anchor: "MIDDLE" }
            }]
        });
        assert.strictEqual(blocked.reasonCodes[0], TypographyReason.INVALID_PLACEMENT);
    });

    await test("keeps position by default and emits placement only after selection", () => {
        const drafts = createManualTypographyDrafts([descriptor(7)]);
        drafts[0].role = "CAPTION";
        assert.deepStrictEqual(buildManualTypographyAssignments(drafts), [{
            layerId: 7,
            role: "CAPTION",
            text: "Original 7",
            preset: null
        }]);
        drafts[0].placementAnchor = "TOP_RIGHT";
        assert.deepStrictEqual(buildManualTypographyAssignments(drafts)[0].placement, {
            anchor: "TOP_RIGHT"
        });
    });

    await test("places a layer at the deterministic bottom-right inset", async () => {
        const { adapter, state } = adapterSetup();
        const result = await adapter.execute({
            plan: readyPlan("BOTTOM_RIGHT"),
            expectedDocumentId: 41
        });
        assert.strictEqual(result.status, TypographyExecutionStatus.SUCCESS);
        assert.deepStrictEqual(state.translations, [{
            horizontal: { _unit: "pixelsUnit", _value: 676 },
            vertical: { _unit: "pixelsUnit", _value: 426 }
        }]);
        assert.deepStrictEqual(state.bounds, { left: 776, top: 526, right: 976, bottom: 576 });
        assert.deepStrictEqual(state.activatedLayerIds, [7]);
        assert.deepStrictEqual(state.resumed, [{ id: "history-1", commit: true }]);
    });

    await test("supports top-centre geometry without requiring a style preset", async () => {
        const { adapter, state } = adapterSetup();
        const result = await adapter.execute({
            plan: readyPlan("TOP_CENTER"),
            expectedDocumentId: 41
        });
        assert.strictEqual(result.status, TypographyExecutionStatus.SUCCESS);
        assert.deepStrictEqual(state.translations, [{
            horizontal: { _unit: "pixelsUnit", _value: 300 },
            vertical: { _unit: "pixelsUnit", _value: -76 }
        }]);
        assert.deepStrictEqual(state.bounds, { left: 400, top: 24, right: 600, bottom: 74 });
    });

    await test("fails closed before modal execution when translation is unavailable", async () => {
        const { adapter, state } = adapterSetup({ translate: false });
        const result = await adapter.execute({
            plan: readyPlan("TOP_LEFT"),
            expectedDocumentId: 41
        });
        assert.strictEqual(result.reasonCode, TypographyExecutionReason.PLACEMENT_UNAVAILABLE);
        assert.strictEqual(state.modalCalls, 0);
    });

    await test("activates the exact planned layer before Photoshop translation", async () => {
        const { adapter, state } = adapterSetup();
        const result = await adapter.execute({
            plan: readyPlan("TOP_RIGHT"),
            expectedDocumentId: 41
        });
        assert.strictEqual(result.status, TypographyExecutionStatus.SUCCESS);
        assert.deepStrictEqual(state.activatedLayerIds, [7]);
    });

    await test("fails closed when a forged anchor or oversized layer cannot fit", async () => {
        const forged = adapterSetup();
        const forgedResult = await forged.adapter.execute({
            plan: readyPlan("MIDDLE"),
            expectedDocumentId: 41
        });
        assert.strictEqual(
            forgedResult.reasonCode,
            TypographyExecutionReason.PLACEMENT_UNAVAILABLE
        );
        assert.strictEqual(forged.state.modalCalls, 0);

        const oversized = adapterSetup({ width: 200, height: 120 });
        const oversizedResult = await oversized.adapter.execute({
            plan: readyPlan("TOP_LEFT"),
            expectedDocumentId: 41
        });
        assert.strictEqual(
            oversizedResult.reasonCode,
            TypographyExecutionReason.PLACEMENT_UNAVAILABLE
        );
        assert.strictEqual(oversized.state.modalCalls, 0);
    });

    await test("rolls back when Photoshop rejects the requested translation", async () => {
        const { adapter, state } = adapterSetup({ rejectTranslation: true });
        const result = await adapter.execute({
            plan: readyPlan("BOTTOM_LEFT"),
            expectedDocumentId: 41
        });
        assert.strictEqual(result.status, TypographyExecutionStatus.FAILED);
        assert.strictEqual(result.reasonCode, TypographyExecutionReason.PHOTOSHOP_REJECTED);
        assert.deepStrictEqual(state.resumed, [{ id: "history-1", commit: false }]);
    });

    await test("connects six explicit positions to the production Typography panel", () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), "src/components/ManualTypographyPanel.jsx"),
            "utf8"
        );
        ["TOP_LEFT", "TOP_CENTER", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_CENTER", "BOTTOM_RIGHT"]
            .forEach(anchor => assert(source.includes(anchor)));
        assert(source.includes("Keep position"));
        assert(source.includes("Position for ${draft.layerName}"));
    });

    console.info(`ALB-123 Quote and Caption Placement: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
