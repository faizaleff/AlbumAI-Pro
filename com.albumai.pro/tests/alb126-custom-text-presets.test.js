import assert from "assert";
import fs from "fs";
import path from "path";

import {
    deleteLocalTextPreset,
    localTextPresetsForRole,
    normalizeLocalTextPresetCatalog,
    saveLocalTextPreset
} from "../src/typography/LocalTextPresetCatalog";
import {
    applyLocalTextSuggestion,
    createLocalTextSuggestionOptions
} from "../src/components/ManualTypographyPanel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-126: ${name}`);
}

const titlePreset = {
    id: "title-1",
    role: "TITLE",
    name: "Wedding title",
    text: "Our Wedding Day"
};

async function run() {
    await test("normalizes valid project-local presets and rejects malformed values", () => {
        const catalog = normalizeLocalTextPresetCatalog({ presets: [
            titlePreset,
            { ...titlePreset },
            { id: "bad", role: "UNKNOWN", name: "Bad", text: "Bad" },
            { id: "empty", role: "CAPTION", name: "", text: "Text" }
        ] });
        assert.strictEqual(catalog.version, 1);
        assert.deepStrictEqual(catalog.presets, [titlePreset]);
        assert(Object.isFrozen(catalog));
        assert(Object.isFrozen(catalog.presets));
    });

    await test("creates and updates a custom preset without mutating prior state", () => {
        const original = normalizeLocalTextPresetCatalog(null);
        const created = saveLocalTextPreset(original, titlePreset);
        assert.strictEqual(created.accepted, true);
        assert.strictEqual(original.presets.length, 0);
        const updated = saveLocalTextPreset(created.catalog, {
            ...titlePreset,
            name: "Album title",
            text: "Together Forever"
        });
        assert.strictEqual(updated.catalog.presets[0].name, "Album title");
        assert.strictEqual(updated.catalog.presets[0].text, "Together Forever");
    });

    await test("blocks duplicate names within one role but permits them across roles", () => {
        const first = saveLocalTextPreset(null, titlePreset).catalog;
        const duplicate = saveLocalTextPreset(first, {
            ...titlePreset,
            id: "title-2",
            name: "wedding TITLE"
        });
        assert.strictEqual(duplicate.accepted, false);
        assert.strictEqual(duplicate.reasonCode, "DUPLICATE_NAME");
        const caption = saveLocalTextPreset(first, {
            ...titlePreset,
            id: "caption-1",
            role: "CAPTION"
        });
        assert.strictEqual(caption.accepted, true);
    });

    await test("deletes only the exact preset", () => {
        const first = saveLocalTextPreset(null, titlePreset).catalog;
        const second = saveLocalTextPreset(first, {
            id: "caption-1",
            role: "CAPTION",
            name: "Caption",
            text: "A lovely day"
        }).catalog;
        const removed = deleteLocalTextPreset(second, titlePreset.id);
        assert.strictEqual(removed.accepted, true);
        assert.deepStrictEqual(removed.catalog.presets.map(item => item.id), ["caption-1"]);
        assert.strictEqual(deleteLocalTextPreset(removed.catalog, "missing").reasonCode, "PRESET_NOT_FOUND");
    });

    await test("keeps custom suggestions isolated by explicit role", () => {
        const catalog = normalizeLocalTextPresetCatalog({ presets: [
            titlePreset,
            { id: "caption-1", role: "CAPTION", name: "Caption", text: "A lovely day" }
        ] });
        assert.deepStrictEqual(localTextPresetsForRole(catalog, "TITLE").map(item => item.id), ["title-1"]);
        const titleOptions = createLocalTextSuggestionOptions("TITLE", catalog);
        assert(titleOptions.some(option => option.value === "custom:title-1"));
        assert(!titleOptions.some(option => option.value === "custom:caption-1"));
    });

    await test("changes draft text only after explicit custom preset selection", () => {
        const catalog = normalizeLocalTextPresetCatalog({ presets: [titlePreset] });
        const draft = { role: "TITLE", text: "Original", suggestionId: "" };
        const untouched = applyLocalTextSuggestion(draft, "", catalog);
        const applied = applyLocalTextSuggestion(draft, "custom:title-1", catalog);
        assert.strictEqual(untouched.text, "Original");
        assert.strictEqual(applied.text, "Our Wedding Day");
        assert.strictEqual(draft.text, "Original");
    });

    await test("wires project persistence without network or Photoshop side effects", () => {
        const panel = fs.readFileSync(path.join(process.cwd(), "src/components/ManualTypographyPanel.jsx"), "utf8");
        const owner = fs.readFileSync(path.join(process.cwd(), "src/components/OpenFolder.jsx"), "utf8");
        const domain = fs.readFileSync(path.join(process.cwd(), "src/typography/LocalTextPresetCatalog.js"), "utf8");
        assert(panel.includes("Custom text presets"));
        assert(!panel.includes("name: event.target.value"));
        assert(!panel.includes("text: event.target.value"));
        assert(owner.includes("typographyTextPresets"));
        assert(owner.includes("ALB126_CUSTOM_TEXT_PRESETS"));
        assert(!domain.includes("photoshop"));
        assert(!domain.includes("fetch("));
    });

    console.info(`ALB-126 Custom Text Presets: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
