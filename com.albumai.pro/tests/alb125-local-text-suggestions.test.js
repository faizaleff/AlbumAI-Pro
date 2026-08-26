import assert from "assert";
import fs from "fs";
import path from "path";

import {
    applyLocalTextSuggestion,
    buildManualTypographyAssignments,
    createLocalTextSuggestionOptions,
    createManualTypographyDrafts
} from "../src/components/ManualTypographyPanel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-125: ${name}`);
}

function textLayer(layerId, textContent = `Original ${layerId}`) {
    return {
        layerId,
        layerName: `Text ${layerId}`,
        textContent,
        visible: true,
        locked: false
    };
}

async function run() {
    await test("keeps no suggestion as the safe default", () => {
        const options = createLocalTextSuggestionOptions("");
        assert.deepStrictEqual(options.map(option => option.label), ["No suggestion"]);
        const draft = createManualTypographyDrafts([textLayer(2, "Existing title")])[0];
        assert.strictEqual(draft.suggestionId, "");
        assert.strictEqual(draft.text, "Existing title");
    });

    await test("keeps suggestions isolated by explicit role", () => {
        const titles = createLocalTextSuggestionOptions("TITLE");
        const captions = createLocalTextSuggestionOptions("CAPTION");
        const quotes = createLocalTextSuggestionOptions("QUOTE");
        assert(titles.some(option => option.text === "Our Story"));
        assert(captions.some(option => option.text === "A moment to remember"));
        assert(quotes.some(option => option.text === "The best days are shared"));
        assert(!captions.some(option => option.text === "Our Story"));
    });

    await test("changes text only after an explicit suggestion selection", () => {
        const source = {
            ...createManualTypographyDrafts([textLayer(2, "Manual title")])[0],
            role: "TITLE"
        };
        const untouched = applyLocalTextSuggestion(source, "");
        assert.strictEqual(untouched.text, "Manual title");
        const suggested = applyLocalTextSuggestion(source, "title-our-story");
        assert.strictEqual(suggested.text, "Our Story");
        assert.strictEqual(source.text, "Manual title");
    });

    await test("keeps selected suggestion text editable and assignment-safe", () => {
        const draft = {
            ...createManualTypographyDrafts([textLayer(2)])[0],
            role: "CAPTION"
        };
        const suggested = applyLocalTextSuggestion(draft, "caption-moment");
        suggested.text = "A custom local edit";
        const assignments = buildManualTypographyAssignments([suggested]);
        assert.strictEqual(assignments[0].text, "A custom local edit");
        assert.strictEqual(assignments[0].preset, null);
    });

    await test("does not expose remote or generative dependencies", () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), "src/components/ManualTypographyPanel.jsx"),
            "utf8"
        );
        assert(!source.includes("fetch("));
        assert(!source.includes("XMLHttpRequest"));
        assert(source.includes("offline local text suggestion"));
    });

    await test("connects the opt-in suggestion selector to the production panel", () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), "src/components/ManualTypographyPanel.jsx"),
            "utf8"
        );
        assert(source.includes("createLocalTextSuggestionOptions(draft.role)"));
        assert(source.includes("Suggestion for ${draft.layerName}"));
        assert(source.includes("disabled={!draft.editable || busy || !draft.role}"));
    });

    console.info(`ALB-125 Local Text Suggestions: PASS (${assertions} tests)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
