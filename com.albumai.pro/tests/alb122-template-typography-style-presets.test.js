import assert from "assert";
import fs from "fs";
import path from "path";

import {
    applyTypographyResultToDocument,
    buildManualTypographyAssignments,
    createManualTypographyDrafts,
    createTemplateTypographyPresetOptions,
    normalizeTemplateTypographyAlignment
} from "../src/components/ManualTypographyPanel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-122: ${name}`);
}

function textLayer(layerId, overrides = {}) {
    return {
        layerId,
        layerName: `Text ${layerId}`,
        textContent: `Original ${layerId}`,
        fontFamily: "ArialMT",
        fontSize: 24,
        color: { red: 0, green: 0, blue: 0 },
        alignment: "left",
        visible: true,
        locked: false,
        ...overrides
    };
}

async function run() {
    await test("normalizes Photoshop alignment aliases without guessing unknown values", () => {
        assert.strictEqual(normalizeTemplateTypographyAlignment("justifyAll"), "justify");
        assert.strictEqual(normalizeTemplateTypographyAlignment("centered"), "center");
        assert.strictEqual(normalizeTemplateTypographyAlignment("rightJustified"), "right");
        assert.strictEqual(normalizeTemplateTypographyAlignment("unexpected"), null);
    });

    await test("builds detached template-local options from canonical reader fields", () => {
        const source = [
            textLayer(2, { layerName: "TITLE", fontFamily: "CervoNeue-SemiBoldNeue", fontSize: 200, alignment: "justifyAll" }),
            textLayer(3, { layerName: "Caption", fontFamily: "ArialNarrow", fontSize: 150, color: { red: 238, green: 79, blue: 79 }, alignment: "centered" })
        ];
        const options = createTemplateTypographyPresetOptions(source);
        assert.strictEqual(options.length, 3);
        assert.strictEqual(options[0].label, "Preserve current style");
        assert.deepStrictEqual(options[1].preset, { fontFamily: "CervoNeue-SemiBoldNeue", fontSize: 200, color: { red: 0, green: 0, blue: 0 }, alignment: "justify" });
        assert.deepStrictEqual(options[2].preset, { fontFamily: "ArialNarrow", fontSize: 150, color: { red: 238, green: 79, blue: 79 }, alignment: "center" });
        options[2].preset.color.red = 1;
        assert.strictEqual(source[1].color.red, 238);
    });

    await test("supports legacy nested styles without changing canonical reader behavior", () => {
        const options = createTemplateTypographyPresetOptions([{ layerId: 4, layerName: "Legacy", style: { fontFamily: "Georgia", fontSize: 44, color: { red: 1, green: 2, blue: 3 }, alignment: "leftJustified" } }]);
        assert.deepStrictEqual(options[1].preset, { fontFamily: "Georgia", fontSize: 44, color: { red: 1, green: 2, blue: 3 }, alignment: "left" });
    });

    await test("keeps preserve-style drafts null and clones only explicit selections", () => {
        const drafts = createManualTypographyDrafts([textLayer(2), textLayer(3)]);
        drafts[0].role = "TITLE";
        drafts[0].text = "New title";
        drafts[1].role = "CAPTION";
        drafts[1].text = "New caption";
        drafts[1].presetId = "2";
        drafts[1].preset = { fontFamily: "CervoNeue-SemiBoldNeue", fontSize: 200, color: { red: 0, green: 0, blue: 0 }, alignment: "justify" };
        const assignments = buildManualTypographyAssignments(drafts);
        assert.strictEqual(assignments[0].preset, null);
        assert.deepStrictEqual(assignments[1].preset, drafts[1].preset);
        assignments[1].preset.color.red = 99;
        assert.strictEqual(drafts[1].preset.color.red, 0);
    });

    await test("refreshes completed previews with canonical style fields only", () => {
        const source = { textLayers: [textLayer(2), textLayer(3)] };
        const drafts = createManualTypographyDrafts(source.textLayers);
        drafts[0].text = "Applied title";
        drafts[0].preset = { fontFamily: "CervoNeue-SemiBoldNeue", fontSize: 200, color: { red: 9, green: 8, blue: 7 }, alignment: "justify" };
        drafts[1].text = "Unchanged caption";
        const updated = applyTypographyResultToDocument(source, drafts, { status: "SUCCESS", completedLayerIds: [2] });
        assert.strictEqual(updated.textLayers[0].textContent, "Applied title");
        assert.strictEqual(updated.textLayers[0].fontFamily, "CervoNeue-SemiBoldNeue");
        assert.strictEqual(updated.textLayers[0].fontSize, 200);
        assert.deepStrictEqual(updated.textLayers[0].color, { red: 9, green: 8, blue: 7 });
        assert.strictEqual(updated.textLayers[0].alignment, "justify");
        assert.strictEqual(updated.textLayers[0].style, undefined);
        assert.strictEqual(updated.textLayers[1].textContent, "Original 3");
        assert.strictEqual(source.textLayers[0].textContent, "Original 2");
        assert.strictEqual(source.textLayers[0].fontFamily, "ArialMT");
    });

    await test("keeps the selector and safe default connected to the production panel", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/ManualTypographyPanel.jsx"), "utf8");
        assert(source.includes("Preserve current style"));
        assert(source.includes("createTemplateTypographyPresetOptions"));
        assert(source.includes("Style for ${draft.layerName}"));
        assert(source.includes("optionally reuse a style already present in this template"));
    });

    console.info(`ALB-122 Template-local Typography Style Presets: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
