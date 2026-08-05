import {
    canProcessProject,
    canRevalidateTemplates,
    executionGateFeedback,
    recoveryCompatibilityLabel,
    revalidationFeedback,
    shouldResetTemplatePreflightUi,
    templateRegistryUiSummary,
    templateValidationLabel
} from "../src/components/templatePreflightUi";

const fs = require("fs");
const path = require("path");
let count = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
    assert(actual === expected, `${message}: expected ${expected}, received ${actual}`);
}

function test(name, callback) {
    callback();
    count++;
    console.log(`PASS ${name}`);
}

function preflight({ ready = 0, missing = 0, ambiguous = 0, accessError = 0, unknown = 0 } = {}) {
    const total = ready + missing + ambiguous + accessError + unknown;
    return { total, ready, missing, ambiguous, accessError, blocking: total - ready };
}

test("all validation states have locked user-facing labels", () => {
    equal(templateValidationLabel("READY"), "Ready", "ready");
    equal(templateValidationLabel("MISSING"), "Missing", "missing");
    equal(templateValidationLabel("AMBIGUOUS"), "Ambiguous", "ambiguous");
    equal(templateValidationLabel("ACCESS_ERROR"), "Access error", "access error");
    equal(templateValidationLabel("UNKNOWN"), "Needs validation", "unknown");
});

test("global summary reports ready and blocking counts", () => {
    const summary = templateRegistryUiSummary([], preflight({ ready: 2, missing: 1, ambiguous: 1 }));
    equal(summary.total, 4, "total");
    equal(summary.ready, 2, "ready");
    equal(summary.blocking, 2, "blocking");
});

test("Revalidate button lifecycle honors project and conflicting work", () => {
    equal(canRevalidateTemplates({ hasProject: true }), true, "enabled");
    equal(canRevalidateTemplates({ hasProject: false }), false, "closed project");
    equal(canRevalidateTemplates({ hasProject: true, isExecuting: true }), false, "executing");
    equal(canRevalidateTemplates({ hasProject: true, registryMutating: true }), false, "mutating");
    equal(canRevalidateTemplates({ hasProject: true, revalidateBusy: true }), false, "busy");
    equal(canRevalidateTemplates({ hasProject: true, workspaceAvailable: false }), false, "workspace unavailable");
});

test("revalidation feedback distinguishes saved, no-op, and persistence failure", () => {
    equal(
        revalidationFeedback({ persisted: true, reason: "USER_REVALIDATE" }),
        "Templates revalidated and changes saved.",
        "saved"
    );
    equal(
        revalidationFeedback({ persisted: false, reason: "USER_REVALIDATE" }),
        "Templates revalidated; no changes found.",
        "no-op"
    );
    equal(
        revalidationFeedback({ persisted: false, reason: "USER_REVALIDATE_PERSISTENCE_FAILED" }),
        "Template validation changed, but the project could not be saved.",
        "failure"
    );
});

["UNKNOWN", "MISSING", "AMBIGUOUS", "ACCESS_ERROR"].forEach(state => {
    test(`Process Project is disabled for ${state}`, () => {
        equal(canProcessProject({
            hasProject: true,
            isExecuting: false,
            entries: [{ validationState: state }],
            preflight: preflight({ unknown: 1 })
        }), false, "process enabled");
    });
});

test("Process Project remains enabled for all READY subject to existing conditions", () => {
    equal(canProcessProject({
        hasProject: true,
        isExecuting: false,
        entries: [{ validationState: "READY" }],
        preflight: preflight({ ready: 1 })
    }), true, "ready enabled");
    equal(canProcessProject({
        hasProject: true,
        isExecuting: true,
        entries: [{ validationState: "READY" }],
        preflight: preflight({ ready: 1 })
    }), false, "execution condition");
});

test("blocked execution results have actionable feedback", () => {
    equal(
        executionGateFeedback({ status: "TEMPLATE_REGISTRY_BLOCKED" }),
        "Template registry needs attention before processing.",
        "blocked"
    );
    equal(
        executionGateFeedback({ status: "TEMPLATE_REGISTRY_PREFLIGHT_PERSISTENCE_FAILED" }),
        "Template validation could not be saved. Processing did not start.",
        "persistence"
    );
});

test("recovery compatibility has non-destructive labels", () => {
    equal(recoveryCompatibilityLabel("COMPATIBLE"), "Compatible", "compatible");
    equal(recoveryCompatibilityLabel("BLOCKED_TEMPLATE_REGISTRY"), "Blocked by template registry", "blocked");
    equal(recoveryCompatibilityLabel("STALE_REGISTRY"), "Registry changed since recovery snapshot", "stale");
});

test("project close and identity change request transient-state cleanup", () => {
    equal(shouldResetTemplatePreflightUi({ hasProject: false, projectId: null, previousProjectId: "a" }), true, "close");
    equal(shouldResetTemplatePreflightUi({ hasProject: true, projectId: "b", previousProjectId: "a" }), true, "change");
    equal(shouldResetTemplatePreflightUi({ hasProject: true, projectId: "a", previousProjectId: "a" }), false, "same project");
});

test("revalidation handler has no recovery-clear or document-open dependency", () => {
    const source = fs.readFileSync(
        path.join(process.cwd(), "src/components/TemplateDocumentPanel.jsx"),
        "utf8"
    );
    const start = source.indexOf("async function revalidateTemplatesRequest()");
    const end = source.indexOf("async function addCurrentPsd()", start);
    const handler = source.slice(start, end);
    assert(start >= 0 && end > start, "revalidation handler missing");
    assert(handler.includes('reason: "USER_REVALIDATE"'), "locked reason missing");
    assert(!handler.includes("clearRecovery"), "handler clears recovery");
    assert(!handler.includes("openTemplate"), "handler opens a template");
    assert(!handler.includes("executeProject"), "handler starts execution");
});

test("project lifecycle effect is primitive-keyed and not preflight-state driven", () => {
    const source = fs.readFileSync(
        path.join(process.cwd(), "src/components/TemplateDocumentPanel.jsx"),
        "utf8"
    );
    const marker = "previousProjectId: revalidationProjectIdRef.current";
    const start = source.indexOf(marker);
    const end = source.indexOf("}, [hasProject, projectId]);", start);
    assert(start >= 0 && end > start, "bounded project lifecycle effect missing");
    const effect = source.slice(start, end);
    assert(!effect.includes("registryPreflightState]"), "preflight state drives its own refresh effect");
});

console.log(`ALB-044 UI tests passed: ${count}`);
