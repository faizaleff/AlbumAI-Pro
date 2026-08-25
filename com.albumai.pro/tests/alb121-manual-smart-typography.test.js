import assert from "assert";
import fs from "fs";
import path from "path";

import ManualTypographyWorkflow, {
    ManualTypographyReason,
    ManualTypographyStatus
} from "../src/typography/ManualTypographyWorkflow";
import {
    applyTypographyResultToDocument,
    buildManualTypographyAssignments,
    createManualTypographyDrafts
} from "../src/components/ManualTypographyPanel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-121: ${name}`);
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

function template(overrides = {}) {
    return {
        id: 41,
        name: "Typography.psd",
        filePath: "/project/Templates/Typography.psd",
        document: { id: 41 },
        textLayers: [textLayer(7), textLayer(8)],
        ...overrides
    };
}

function assignments() {
    return [
        { layerId: 7, role: "TITLE", text: "Album title", preset: null },
        { layerId: 8, role: "CAPTION", text: "Album caption", preset: null }
    ];
}

function setup(execution = null) {
    const calls = [];
    const adapter = {
        async execute(request) {
            calls.push(request);
            return execution || {
                status: "SUCCESS",
                reasonCode: null,
                completedLayerIds: [7, 8],
                failedLayerId: null
            };
        }
    };
    return { calls, workflow: new ManualTypographyWorkflow({ adapter }) };
}

async function run() {
    await test("builds a deterministic plan and invokes the exact document boundary", async () => {
        const { calls, workflow } = setup();
        const result = await workflow.execute({
            template: template(),
            expectedDocumentId: 41,
            assignments: assignments()
        });

        assert.strictEqual(result.status, ManualTypographyStatus.SUCCESS);
        assert.deepStrictEqual(result.completedLayerIds, [7, 8]);
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].expectedDocumentId, 41);
        assert.strictEqual(calls[0].plan.templateId, "/project/Templates/Typography.psd");
        assert.deepStrictEqual(calls[0].plan.steps.map(step => step.layerId), [7, 8]);
        assert(calls[0].plan.steps.every(step => step.preset === null));
    });

    await test("blocks an active-document mismatch before Photoshop mutation", async () => {
        const { calls, workflow } = setup();
        const result = await workflow.execute({
            template: template(),
            expectedDocumentId: 99,
            assignments: assignments()
        });

        assert.strictEqual(result.status, ManualTypographyStatus.BLOCKED);
        assert.strictEqual(result.reasonCode, ManualTypographyReason.DOCUMENT_MISMATCH);
        assert.strictEqual(calls.length, 0);
    });

    await test("requires a current template and at least one explicit assignment", async () => {
        const { calls, workflow } = setup();
        const missingTemplate = await workflow.execute({
            template: null,
            expectedDocumentId: 41,
            assignments: assignments()
        });
        const empty = await workflow.execute({
            template: template(),
            expectedDocumentId: 41,
            assignments: []
        });

        assert.strictEqual(missingTemplate.reasonCode, ManualTypographyReason.TEMPLATE_REQUIRED);
        assert.strictEqual(empty.reasonCode, ManualTypographyReason.NO_ASSIGNMENTS);
        assert.strictEqual(calls.length, 0);
    });

    await test("does not execute a plan targeting a missing or non-editable layer", async () => {
        const { calls, workflow } = setup();
        const missing = await workflow.execute({
            template: template(),
            expectedDocumentId: 41,
            assignments: [{ layerId: 99, role: "TITLE", text: "Missing", preset: null }]
        });
        const locked = await workflow.execute({
            template: template({ textLayers: [textLayer(7, { locked: true })] }),
            expectedDocumentId: 41,
            assignments: [{ layerId: 7, role: "TITLE", text: "Locked", preset: null }]
        });

        assert.strictEqual(missing.reasonCode, "TARGET_NOT_FOUND");
        assert.strictEqual(locked.reasonCode, "TARGET_NOT_EDITABLE");
        assert.strictEqual(calls.length, 0);
    });

    await test("surfaces adapter failure without reporting false success", async () => {
        const { workflow } = setup({
            status: "FAILED",
            reasonCode: "PHOTOSHOP_REJECTED",
            completedLayerIds: [],
            failedLayerId: 7
        });
        const result = await workflow.execute({
            template: template(),
            expectedDocumentId: 41,
            assignments: assignments()
        });

        assert.strictEqual(result.status, ManualTypographyStatus.FAILED);
        assert.strictEqual(result.reasonCode, "PHOTOSHOP_REJECTED");
        assert.strictEqual(result.failedLayerId, 7);
    });

    await test("drafts preserve text and emit only explicit editable assignments", async () => {
        const drafts = createManualTypographyDrafts([
            textLayer(7),
            textLayer(8, { locked: true }),
            textLayer(9)
        ]);
        drafts[0].role = "TITLE";
        drafts[0].text = "New title";
        drafts[1].role = "CAPTION";
        drafts[2].text = "No role";

        assert.strictEqual(drafts[0].text, "New title");
        assert.strictEqual(drafts[1].editable, false);
        assert.deepStrictEqual(buildManualTypographyAssignments(drafts), [{
            layerId: 7,
            role: "TITLE",
            text: "New title",
            preset: null
        }]);
    });

    await test("updates only successfully completed layer previews", async () => {
        const source = template();
        const drafts = createManualTypographyDrafts(source.textLayers);
        drafts[0].text = "Applied";
        drafts[1].text = "Not completed";
        const updated = applyTypographyResultToDocument(source, drafts, {
            status: "SUCCESS",
            completedLayerIds: [7]
        });

        assert.strictEqual(updated.textLayers[0].textContent, "Applied");
        assert.strictEqual(updated.textLayers[1].textContent, "Original 8");
        assert.strictEqual(applyTypographyResultToDocument(source, drafts, {
            status: "FAILED"
        }), source);
    });

    await test("renders template details and typography outside disabled legacy diagnostics", async () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), "src/components/TemplateDocumentPanel.jsx"),
            "utf8"
        );
        const detailsIndex = source.indexOf('className="template-document-details"');

        assert(detailsIndex > -1, "Template details block must be rendered.");
        assert(!source.includes("{false && <>"),
            "Disabled legacy diagnostics must not remain in the production component.");
        assert(source.includes("Template Open: {templateOpenError}"),
            "Open failures must be visible to the operator.");
        assert(source.includes("<ManualTypographyPanel"),
            "Manual Typography must be integrated with template details.");
    });

    console.info(`ALB-121 Manual Smart Typography: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
