import assert from "assert";
import fs from "fs";
import path from "path";

import {
    applyTypographyResultToDocument,
    buildManualTypographyAssignments,
    createManualTypographyDrafts,
    createTemplateTypographyFontOptions,
    createTemplateTypographyStyleOptions,
    mergeTypographyPresets
} from "../src/components/ManualTypographyPanel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-124: ${name}`);
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
    await test("builds exact template-local font choices without duplicates", () => {
        const options = createTemplateTypographyFontOptions([
            textLayer(2, { fontFamily: " ArialMT " }),
            textLayer(3, { fontFamily: "ArialMT" }),
            textLayer(4, { fontFamily: "CervoNeue-SemiBoldNeue" }),
            textLayer(5, { fontFamily: "" })
        ]);
        assert.deepStrictEqual(options.map(option => option.label), [
            "Preserve current font",
            "Font: ArialMT",
            "Font: CervoNeue-SemiBoldNeue"
        ]);
        assert.deepStrictEqual(options[1].preset, { fontFamily: "ArialMT" });
    });

    await test("builds style choices without silently changing the font", () => {
        const options = createTemplateTypographyStyleOptions([
            textLayer(2, {
                layerName: "TITLE",
                fontFamily: "CervoNeue-SemiBoldNeue",
                fontSize: 200,
                color: { red: 1, green: 2, blue: 3 },
                alignment: "centered"
            })
        ]);
        assert.strictEqual(options[0].label, "Preserve current style");
        assert.strictEqual(options[1].label, "Style: TITLE");
        assert.deepStrictEqual(options[1].preset, {
            fontSize: 200,
            color: { red: 1, green: 2, blue: 3 },
            alignment: "center"
        });
        assert.strictEqual(options[1].preset.fontFamily, undefined);
    });

    await test("merges an explicit font and style into one detached adapter preset", () => {
        const font = { fontFamily: "ArialNarrow" };
        const style = {
            fontSize: 150,
            color: { red: 238, green: 79, blue: 79 },
            alignment: "center"
        };
        const merged = mergeTypographyPresets(font, style);
        assert.deepStrictEqual(merged, { fontFamily: "ArialNarrow", ...style });
        merged.color.red = 0;
        assert.strictEqual(style.color.red, 238);
    });

    await test("keeps both independent selectors opt-in and assignment-safe", () => {
        const drafts = createManualTypographyDrafts([textLayer(2)]);
        drafts[0].role = "TITLE";
        drafts[0].text = "Album title";
        assert.strictEqual(buildManualTypographyAssignments(drafts)[0].preset, null);
        drafts[0].fontPreset = { fontFamily: "CervoNeue-SemiBoldNeue" };
        drafts[0].stylePreset = { fontSize: 180, alignment: "center" };
        assert.deepStrictEqual(buildManualTypographyAssignments(drafts)[0].preset, {
            fontFamily: "CervoNeue-SemiBoldNeue",
            fontSize: 180,
            alignment: "center"
        });
    });

    await test("refreshes the completed document preview with the combined preset", () => {
        const source = { textLayers: [textLayer(2)] };
        const drafts = createManualTypographyDrafts(source.textLayers);
        drafts[0].text = "Preset title";
        drafts[0].fontPreset = { fontFamily: "CervoNeue-SemiBoldNeue" };
        drafts[0].stylePreset = {
            fontSize: 180,
            color: { red: 9, green: 8, blue: 7 },
            alignment: "center"
        };
        const updated = applyTypographyResultToDocument(source, drafts, {
            status: "SUCCESS",
            completedLayerIds: [2]
        });
        assert.strictEqual(updated.textLayers[0].fontFamily, "CervoNeue-SemiBoldNeue");
        assert.strictEqual(updated.textLayers[0].fontSize, 180);
        assert.deepStrictEqual(updated.textLayers[0].color, { red: 9, green: 8, blue: 7 });
        assert.strictEqual(source.textLayers[0].fontFamily, "ArialMT");
    });

    await test("connects separate font and style selectors to the production panel", () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), "src/components/ManualTypographyPanel.jsx"),
            "utf8"
        );
        assert(source.includes("createTemplateTypographyFontOptions"));
        assert(source.includes("createTemplateTypographyStyleOptions"));
        assert(source.includes("options={fontOptions}"));
        assert(source.includes("options={styleOptions}"));
        assert(source.includes("Font for ${draft.layerName}"));
        assert(source.includes("Style for ${draft.layerName}"));
    });

    console.info(`ALB-124 Font and Style Presets: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
