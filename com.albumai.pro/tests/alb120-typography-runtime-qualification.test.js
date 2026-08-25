import assert from "assert";

import TypographyRuntimeQualification, {
    TypographyQualificationReason,
    TypographyQualificationStatus
} from "../src/typography/TypographyRuntimeQualification";
import TemplateLayerTreeReader from "../src/services/TemplateLayerTreeReader";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-120: ${name}`);
}

function textLayer(layerId, overrides = {}) {
    return {
        documentId: 41,
        layerId,
        parentGroupId: null,
        parentGroupName: null,
        layerName: `Text ${layerId}`,
        layerType: "textLayer",
        textContent: `Original ${layerId}`,
        fontFamily: "ArialMT",
        fontSize: 24,
        color: { red: 0, green: 0, blue: 0 },
        alignment: "left",
        visible: true,
        locked: false,
        bounds: { left: 0, top: 0, right: 100, bottom: 20 },
        ...overrides
    };
}

function assignments() {
    return [
        { layerId: 7, role: "TITLE", text: "Runtime title", preset: null },
        { layerId: 8, role: "CAPTION", text: "Runtime caption", preset: null }
    ];
}

function setup({ activeDocument = { id: 41 }, layers = [textLayer(7), textLayer(8)],
    execution = null } = {}) {
    const state = { reads: 0, clears: 0, adapterCalls: [] };
    const layerTreeReader = {
        read(document) {
            assert.strictEqual(document, activeDocument);
            state.reads += 1;
        },
        textLayers() { return layers; },
        clear() { state.clears += 1; }
    };
    const adapter = {
        async execute(request) {
            state.adapterCalls.push(request);
            return execution || {
                status: "SUCCESS",
                reasonCode: null,
                completedLayerIds: [7, 8],
                failedLayerId: null
            };
        }
    };
    return {
        state,
        sourceLayers: layers,
        qualification: new TypographyRuntimeQualification({
            photoshopApp: { activeDocument },
            layerTreeReader,
            adapter
        })
    };
}

async function run() {
    await test("normalizes the live UXP text kind before typography inventory", async () => {
        const uxpTextLayer = (id, name, contents) => ({
            id,
            name,
            kind: "text",
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: "normal",
            bounds: null,
            layers: [],
            textItem: {
                contents,
                characterStyle: {},
                paragraphStyle: {}
            }
        });
        const activeDocument = {
            id: 192,
            layers: [
                uxpTextLayer(7, "TITLE", "TITLE"),
                uxpTextLayer(8, "Caption", "Runtime caption")
            ]
        };
        const qualification = new TypographyRuntimeQualification({
            photoshopApp: { activeDocument },
            layerTreeReader: new TemplateLayerTreeReader(),
            adapter: {
                async execute() {
                    throw new Error("Inspection must not execute Photoshop mutations.");
                }
            }
        });

        const report = qualification.inspect();

        assert.strictEqual(report.status, TypographyQualificationStatus.READY);
        assert.strictEqual(report.documentId, 192);
        assert.strictEqual(report.textLayerCount, 2);
        assert.deepStrictEqual(report.textLayers.map(item => item.layerId), [7, 8]);
        assert.deepStrictEqual(
            report.textLayers.map(item => item.currentText),
            ["TITLE", "Runtime caption"]
        );
    });

    await test("inspection returns detached exact text-layer identities", async () => {
        const { qualification, state, sourceLayers } = setup();
        const report = qualification.inspect();

        assert.strictEqual(report.status, TypographyQualificationStatus.READY);
        assert.strictEqual(report.documentId, 41);
        assert.strictEqual(report.textLayerCount, 2);
        assert.deepStrictEqual(report.textLayers.map(item => item.layerId), [7, 8]);
        assert.strictEqual(state.reads, 1);
        assert.strictEqual(state.clears, 1);
        assert(Object.isFrozen(report));
        assert(Object.isFrozen(report.textLayers[0].style));
        assert.notStrictEqual(report.textLayers[0], sourceLayers[0]);
    });

    await test("inspection blocks a document with fewer than two text layers", async () => {
        const { qualification, state } = setup({ layers: [] });
        const report = qualification.inspect();

        assert.strictEqual(report.status, TypographyQualificationStatus.BLOCKED);
        assert.strictEqual(
            report.reasonCode,
            TypographyQualificationReason.INSUFFICIENT_TEXT_LAYERS
        );
        assert.strictEqual(report.textLayerCount, 0);
        assert.deepStrictEqual(report.textLayers, []);
        assert.strictEqual(state.clears, 1);
    });

    await test("execution refuses mutation without disposable-fixture confirmation", async () => {
        const { qualification, state } = setup();
        const report = await qualification.execute({
            expectedDocumentId: 41,
            assignments: assignments()
        });

        assert.strictEqual(report.reasonCode, TypographyQualificationReason.CONFIRMATION_REQUIRED);
        assert.strictEqual(state.reads, 0);
        assert.strictEqual(state.adapterCalls.length, 0);
    });

    await test("execution requires the exact active document id", async () => {
        const { qualification, state } = setup();
        const report = await qualification.execute({
            confirmDisposableDocument: true,
            expectedDocumentId: 99,
            assignments: assignments()
        });

        assert.strictEqual(report.reasonCode, TypographyQualificationReason.DOCUMENT_MISMATCH);
        assert.strictEqual(report.activeDocumentId, 41);
        assert.strictEqual(state.adapterCalls.length, 0);
    });

    await test("qualification is intentionally bounded to exactly two assignments", async () => {
        const { qualification, state } = setup();
        const report = await qualification.execute({
            confirmDisposableDocument: true,
            expectedDocumentId: 41,
            assignments: assignments().slice(0, 1)
        });

        assert.strictEqual(
            report.reasonCode,
            TypographyQualificationReason.EXACTLY_TWO_ASSIGNMENTS_REQUIRED
        );
        assert.strictEqual(state.adapterCalls.length, 0);
    });

    await test("execution never reaches Photoshop when the fixture has too few text layers", async () => {
        const { qualification, state } = setup({ layers: [textLayer(7)] });
        const report = await qualification.execute({
            confirmDisposableDocument: true,
            expectedDocumentId: 41,
            assignments: assignments()
        });

        assert.strictEqual(report.status, TypographyQualificationStatus.BLOCKED);
        assert.strictEqual(
            report.reasonCode,
            TypographyQualificationReason.INSUFFICIENT_TEXT_LAYERS
        );
        assert.strictEqual(report.textLayerCount, 1);
        assert.strictEqual(state.adapterCalls.length, 0);
        assert.strictEqual(state.clears, 1);
    });

    await test("builds a READY two-step plan and delegates to the real adapter boundary", async () => {
        const { qualification, state } = setup();
        const report = await qualification.execute({
            confirmDisposableDocument: true,
            expectedDocumentId: 41,
            templateId: "fixture-template",
            assignments: assignments()
        });

        assert.strictEqual(report.status, TypographyQualificationStatus.SUCCESS);
        assert.strictEqual(report.planStepCount, 2);
        assert.deepStrictEqual(report.targetLayerIds, [7, 8]);
        assert.strictEqual(state.adapterCalls.length, 1);
        assert.strictEqual(state.adapterCalls[0].expectedDocumentId, 41);
        assert.strictEqual(state.adapterCalls[0].plan.templateId, "fixture-template");
        assert.strictEqual(state.adapterCalls[0].plan.state, "READY");
        assert.deepStrictEqual(
            state.adapterCalls[0].plan.steps.map(step => step.layerId),
            [7, 8]
        );
        assert.strictEqual(state.clears, 1);
    });

    await test("blocked domain plans never reach the Photoshop adapter", async () => {
        const { qualification, state } = setup();
        const invalidAssignments = assignments();
        invalidAssignments[1] = {
            layerId: 999,
            role: "CAPTION",
            text: "Missing target",
            preset: null
        };
        const report = await qualification.execute({
            confirmDisposableDocument: true,
            expectedDocumentId: 41,
            assignments: invalidAssignments
        });

        assert.strictEqual(report.reasonCode, TypographyQualificationReason.PLAN_BLOCKED);
        assert.deepStrictEqual(report.planReasonCodes, ["TARGET_NOT_FOUND"]);
        assert.strictEqual(state.adapterCalls.length, 0);
        assert.strictEqual(state.clears, 1);
    });

    await test("adapter failure is reported without a false qualification success", async () => {
        const { qualification } = setup({
            execution: {
                status: "FAILED",
                reasonCode: "FONT_UNAVAILABLE",
                completedLayerIds: [],
                failedLayerId: 7
            }
        });
        const report = await qualification.execute({
            confirmDisposableDocument: true,
            expectedDocumentId: 41,
            assignments: assignments()
        });

        assert.strictEqual(report.status, TypographyQualificationStatus.FAILED);
        assert.strictEqual(report.reasonCode, TypographyQualificationReason.EXECUTION_FAILED);
        assert.strictEqual(report.executionReasonCode, "FONT_UNAVAILABLE");
        assert.strictEqual(report.failedLayerId, 7);
        assert(Object.isFrozen(report));
    });

    console.info(`ALB-120 Typography Runtime Qualification: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
