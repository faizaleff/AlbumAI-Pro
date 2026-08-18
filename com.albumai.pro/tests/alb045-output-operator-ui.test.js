import assert from "assert";
import fs from "fs";
import path from "path";
import { AppController } from "../src/app/AppController";
import {
    OutputOperatorState,
    outputOperatorStateDetails,
    resolveBatchPanelOutputRecovery,
    summarizeOutputRecovery
} from "../src/project/OutputRecoveryOperatorState";
import {
    OutputCancellationState,
    OutputKind,
    OutputTransactionState
} from "../src/project/OutputTransactionState";

function transaction(commitState, extras = {}) {
    return {
        commitState,
        cancellationState: OutputCancellationState.NONE,
        displayName: "safe-output.jpg",
        outputKind: OutputKind.EXPORT_JPEG,
        ...extras
    };
}
function outcome(templateId, status, autoSave, exportResult) {
    return {
        templateId,
        templateName: `${templateId}.psd`,
        status,
        outputTransactions: { autoSave, export: exportResult }
    };
}
function test(name, callback) {
    callback();
    console.info(`PASS ALB-045 Slice 6: ${name}`);
}

test("operator labels make every locked recovery state explicit", () => {
    assert.strictEqual(outputOperatorStateDetails(OutputOperatorState.COMMITTED).label, "Committed");
    assert.strictEqual(outputOperatorStateDetails(OutputOperatorState.SAFE_RETRY).label, "Safe to retry");
    assert.strictEqual(outputOperatorStateDetails(OutputOperatorState.COMMIT_UNKNOWN).label, "Commit unknown");
    assert.strictEqual(outputOperatorStateDetails(OutputOperatorState.REMEDIATION_REQUIRED).label, "Cleanup required");
});

test("mixed output states produce deterministic counts and retry controls", () => {
    const summary = summarizeOutputRecovery({ templateOutcomes: [
        outcome("committed", "CANCELLED", null, transaction(OutputTransactionState.COMMITTED, { cancellationState: OutputCancellationState.EFFECTIVE_AFTER_COMMIT })),
        outcome("retry", "FAILED", transaction(OutputTransactionState.CLEANED), null),
        outcome("unknown", "FAILED", null, transaction(OutputTransactionState.COMMIT_UNKNOWN)),
        outcome("cleanup", "FAILED", null, transaction(OutputTransactionState.CLEANUP_FAILED, { remediationRequired: true }))
    ] });
    assert.deepStrictEqual(summary.counts, {
        COMMITTED: 1, SAFE_RETRY: 1, COMMIT_UNKNOWN: 1, REMEDIATION_REQUIRED: 1
    });
    assert.strictEqual(summary.automaticRetryTemplates, 1);
    assert.strictEqual(summary.skippedCommittedTemplates, 1);
    assert.strictEqual(summary.blockedTemplates, 1);
    assert.strictEqual(summary.remediationTemplates, 1);
    assert.strictEqual(summary.automaticRetryBlocked, true);
});

test("pending templates without outcomes remain explicit safe-retry work", () => {
    const summary = summarizeOutputRecovery({
        pendingTemplateIds: ["never-started"],
        templateOutcomes: []
    });
    assert.strictEqual(summary.counts.SAFE_RETRY, 1);
    assert.strictEqual(summary.automaticRetryTemplates, 1);
    assert.strictEqual(summary.rows[0].templateName, "never-started");
});

test("operator rows remove unsafe names and never serialize host values", () => {
    const summary = summarizeOutputRecovery({ templateOutcomes: [{
        templateId: "safe-id",
        templateName: "/private/template.psd",
        status: "FAILED",
        outputTransactions: {
            autoSave: transaction(OutputTransactionState.COMMIT_UNKNOWN, {
                displayName: "/private/output.psd",
                nativePath: "/private/output.psd",
                entry: { delete() {} },
                error: new Error("unsafe")
            })
        }
    }] });
    const serialized = JSON.stringify(summary);
    assert.strictEqual(summary.rows[0].templateName, "safe-id");
    assert.strictEqual(summary.rows[0].outputName, "—");
    assert.strictEqual(serialized.includes("/private"), false);
    assert.strictEqual(serialized.includes("delete"), false);
});

test("controller recovery state exposes the same authoritative operator summary", () => {
    const controller = Object.create(AppController.prototype);
    const state = controller.recoveryState({
        lifecycle: "CANCELLED",
        pendingTemplateIds: ["unknown"],
        failedTemplateIds: ["unknown"],
        templateOutcomes: [outcome("unknown", "FAILED", null, transaction(OutputTransactionState.COMMIT_UNKNOWN))]
    });
    assert.strictEqual(state.outputRecovery.counts.COMMIT_UNKNOWN, 1);
    assert.strictEqual(state.outputRecovery.automaticRetryTemplates, 0);
    assert.strictEqual(state.outputRecovery.blockedTemplates, 1);
});

test("batch panel prefers authoritative recovery totals over partial template results", () => {
    const recoveryOutput = summarizeOutputRecovery({
        pendingTemplateIds: ["one", "two", "three"],
        templateOutcomes: []
    });
    const panelOutput = resolveBatchPanelOutputRecovery({
        recoveryOutput,
        templateResults: [outcome("one", "CANCELLED", null, null)]
    });
    assert.strictEqual(panelOutput.counts.SAFE_RETRY, 3);
    assert.strictEqual(panelOutput.rows.length, 3);
});

test("UI hides automatic actions without safe work and includes operator diagnostics", () => {
    const panel = fs.readFileSync(path.join(process.cwd(), "src/components/TemplateDocumentPanel.jsx"), "utf8") +
        fs.readFileSync(path.join(process.cwd(), "src/components/ExecutionDetailsPanel.jsx"), "utf8");
    const progress = fs.readFileSync(path.join(process.cwd(), "src/components/BatchProgressPanel.jsx"), "utf8");
    const executor = fs.readFileSync(path.join(process.cwd(), "src/project/ProjectExecutor.js"), "utf8");
    const projectSummary = fs.readFileSync(path.join(process.cwd(), "src/project/ProjectExecutionSummary.js"), "utf8");
    assert(panel.includes("outputRecovery.automaticRetryTemplates > 0"));
    assert(panel.includes("One or more output commits are unknown. Automatic retry is blocked."));
    assert(panel.includes("Cleanup is required before affected templates can be retried."));
    assert(panel.includes("Committed Outputs"));
    assert(panel.includes("Safe Retry Outputs"));
    assert(panel.includes("Output Recovery States"));
    assert(panel.includes("Overwrite Original (non-reversible)"));
    assert(progress.includes('aria-label="Output transaction summary"'));
    assert(progress.includes("Automatic retry is blocked for ambiguous or remediation-required outputs."));
    assert(progress.includes("recoveryOutput = null"));
    assert(panel.includes("recoveryOutput={recoveryState?.outputRecovery || null}"));
    assert(progress.includes('["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(status)'));
    assert(!progress.includes('terminal && status !== "FAILED"'));
    assert(panel.includes("const allTemplatesProcessed"));
    assert(panel.includes("terminalBatch?.currentTemplate?.name"));
    assert(executor.includes('"Template cancelled; selected photos were not consumed."'));
    assert(executor.includes("batch.cancelledAtStage"));
    assert(executor.includes("ProjectExecutionStatus.CANCELLED"));
    assert(projectSummary.includes('CANCELLED: "CANCELLED"'));
});

console.info("ALB-045 Slice 6 operator recovery UI tests complete.");
