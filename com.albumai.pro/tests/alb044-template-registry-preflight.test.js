import TemplateRegistryPreflightService from "../src/services/TemplateRegistryPreflightService";
import {
    TemplateRegistryValidationReason as Reason,
    TemplateRegistryValidationState as State,
    isBlockingTemplateRegistryValidationState,
    normalizeTemplateRegistryValidation
} from "../src/project/TemplateRegistryValidationState";

const service = new TemplateRegistryPreflightService();
let count = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
    assert(actual === expected, `${message}: expected ${expected}, received ${actual}`);
}

function descriptor(id, fileName) {
    return {
        id,
        name: fileName,
        fileReference: fileName,
        fileName,
        registrationOrder: Number(id.replace(/\D/g, "")) || 0
    };
}

function entry(name, extras = {}) {
    return { name, isFile: true, ...extras };
}

function validate(descriptors, workspaceTemplates) {
    return service.validate({ descriptors, workspaceTemplates });
}

function test(name, callback) {
    callback();
    count++;
    console.log(`PASS ${name}`);
}

test("empty registry returns no results", () => {
    const result = validate([], [entry("unused.psd")]);
    equal(result.results.length, 0, "result count");
    equal(result.blockingTemplateIds.length, 0, "blocking count");
});

test("one uniquely matching descriptor is READY", () => {
    const result = validate([descriptor("template-1", "Cover.psd")], [entry("Cover.psd")]);
    equal(result.results[0].state, State.READY, "state");
    equal(result.results[0].reasonCode, Reason.UNIQUE_MATCH, "reason");
    equal(result.results[0].blocking, false, "blocking");
});

test("missing entry is MISSING", () => {
    const result = validate([descriptor("template-1", "Cover.psd")], []);
    equal(result.results[0].state, State.MISSING, "state");
    equal(result.results[0].reasonCode, Reason.NO_MATCH, "reason");
});

test("duplicate matching PSD names are AMBIGUOUS", () => {
    const result = validate([descriptor("template-1", "Cover.psd")], [
        entry("Cover.psd"), entry("Cover.psd")
    ]);
    equal(result.results[0].state, State.AMBIGUOUS, "state");
    equal(result.results[0].reasonCode, Reason.MULTIPLE_MATCHES, "reason");
});

test("non-PSD entries are ignored", () => {
    const result = validate([descriptor("template-1", "Cover.psd")], [
        entry("Cover.jpg"), entry("Cover.psb"), { name: "Cover.psd", isFile: false }
    ]);
    equal(result.results[0].state, State.MISSING, "state");
});

test("entry metadata access error is ACCESS_ERROR", () => {
    const inaccessible = { name: "Cover.psd" };
    Object.defineProperty(inaccessible, "isFile", {
        get() { throw new Error("denied"); }
    });
    const result = validate([descriptor("template-1", "Cover.psd")], [inaccessible]);
    equal(result.results[0].state, State.ACCESS_ERROR, "state");
    equal(result.results[0].reasonCode, Reason.STORAGE_INSPECTION_FAILED, "reason");
});

test("mixed results remain deterministic", () => {
    const result = validate([
        descriptor("template-1", "Ready.psd"),
        descriptor("template-2", "Missing.psd"),
        descriptor("template-3", "Duplicate.psd")
    ], [entry("Ready.psd"), entry("Duplicate.psd"), entry("Duplicate.psd")]);
    equal(result.results.map(item => item.state).join(","), "READY,MISSING,AMBIGUOUS", "states");
    equal(result.blockingTemplateIds.join(","), "template-2,template-3", "blocking IDs");
});

test("descriptor order is preserved", () => {
    const result = validate([
        descriptor("template-3", "Third.psd"),
        descriptor("template-1", "First.psd"),
        descriptor("template-2", "Second.psd")
    ], [entry("First.psd"), entry("Second.psd"), entry("Third.psd")]);
    equal(result.results.map(item => item.templateId).join(","), "template-3,template-1,template-2", "result order");
});

test("inputs are not mutated", () => {
    const descriptors = [descriptor("template-1", "Cover.psd")];
    const entries = [entry("Cover.psd")];
    const before = JSON.stringify({ descriptors, entries });
    validate(descriptors, entries);
    equal(JSON.stringify({ descriptors, entries }), before, "input snapshot");
});

test("legacy values normalize to blocking UNKNOWN", () => {
    const normalized = normalizeTemplateRegistryValidation({ validationState: "legacy" });
    equal(normalized.state, State.UNKNOWN, "normalized state");
    equal(normalized.reasonCode, Reason.NOT_VALIDATED, "normalized reason");
    equal(isBlockingTemplateRegistryValidationState(normalized.state), true, "unknown blocking");
    equal(isBlockingTemplateRegistryValidationState(State.READY), false, "ready not blocking");
});

test("matching is explicitly case-sensitive like current resolver equality", () => {
    const result = validate([descriptor("template-1", "Cover.psd")], [entry("cover.psd")]);
    equal(result.results[0].state, State.MISSING, "case-sensitive state");
});

test("validation has no Photoshop document API dependency", () => {
    const original = globalThis.photoshop;
    globalThis.photoshop = {
        app: { open() { throw new Error("must not open"); } },
        core: { executeAsModal() { throw new Error("must not execute modal"); } }
    };
    try {
        const result = validate([descriptor("template-1", "Cover.psd")], [entry("Cover.psd")]);
        equal(result.results[0].state, State.READY, "state");
    } finally {
        globalThis.photoshop = original;
    }
});

console.log(`ALB-044 preflight tests passed: ${count}`);
