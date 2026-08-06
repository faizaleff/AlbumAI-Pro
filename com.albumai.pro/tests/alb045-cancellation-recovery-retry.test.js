import assert from "assert";
import { AppController } from "../src/app/AppController";
import BatchExecutionService from "../src/project/BatchExecutionService";
import BatchRecoverySnapshot from "../src/project/BatchRecoverySnapshot";
import {
    TemplateOutputRetryDisposition as Disposition,
    canAutomaticallyRetryTemplateOutcome,
    snapshotTemplateOutputTransactions,
    templateOutputRetryDisposition
} from "../src/project/OutputTransactionRecovery";
import {
    OutputCancellationState as Cancellation,
    OutputKind,
    OutputTransactionState as State
} from "../src/project/OutputTransactionState";

function transaction(commitState, cancellationState = Cancellation.NONE) {
    return { commitState, cancellationState, displayName: "safe-output.jpg", outputKind: OutputKind.EXPORT_JPEG };
}
function test(name, callback) { return Promise.resolve().then(callback).then(() => console.info(`PASS ALB-045 Slice 5: ${name}`)); }

function recoveryController(snapshot) {
    const controller = Object.create(AppController.prototype);
    controller.batchRecoverySnapshot = snapshot;
    controller.batchRecoveryClassification = null;
    controller.batchCancellationController = null;
    controller.queueRecoveryWrite = () => {};
    controller.projectTemplateRegistry = {
        getAll: () => snapshot.queueOrder.map(id => ({ id, name: `${id}.psd` }))
    };
    controller.requireRecoverableSnapshot = () => snapshot;
    controller.executeProject = async (_, options) => options;
    return controller;
}

async function run() {
    await test("recovery snapshots strip paths, errors, entries, and legacy success fails closed", () => {
        const entry = { nativePath: "/private/output.jpg", delete() {} };
        const snapshots = snapshotTemplateOutputTransactions({
            autoSaveResult: { status: "SAVED", outputPath: "/private/unsafe.psd", error: new Error("unsafe") },
            exportResult: { status: "SUCCESS", outputTransaction: { ...transaction(State.COMMITTED), entry, nativePath: "/private/export.jpg" } }
        });
        assert.strictEqual(snapshots.autoSave.commitState, State.COMMIT_UNKNOWN);
        assert.strictEqual(snapshots.export.commitState, State.COMMITTED);
        assert.strictEqual(JSON.stringify(snapshots).includes("private"), false);
        assert.strictEqual(JSON.stringify(snapshots).includes("delete"), false);
    });

    await test("committed-after-cancellation is complete-by-default and skipped", () => {
        const outputTransactions = snapshotTemplateOutputTransactions({
            exportResult: { outputTransaction: transaction(State.COMMITTED, Cancellation.EFFECTIVE_AFTER_COMMIT) }
        });
        const outcome = { status: "CANCELLED", outputTransactions };
        assert.strictEqual(templateOutputRetryDisposition(outcome), Disposition.SKIP_DEFAULT);
        assert.strictEqual(canAutomaticallyRetryTemplateOutcome(outcome), false);
    });

    await test("unknown and cleanup-failed output states cannot enter automatic retry", () => {
        const unknown = { status: "FAILED", outputTransactions: snapshotTemplateOutputTransactions({ exportResult: { outputTransaction: transaction(State.COMMIT_UNKNOWN) } }) };
        const cleanup = { status: "FAILED", outputTransactions: snapshotTemplateOutputTransactions({ exportResult: { outputTransaction: transaction(State.CLEANUP_FAILED) } }) };
        assert.strictEqual(templateOutputRetryDisposition(unknown), Disposition.BLOCKED);
        assert.strictEqual(templateOutputRetryDisposition(cleanup), Disposition.REMEDIATION_REQUIRED);
        assert.strictEqual(canAutomaticallyRetryTemplateOutcome(unknown), false);
        assert.strictEqual(canAutomaticallyRetryTemplateOutcome(cleanup), false);
    });

    await test("batch result carries detached output facts through a cancelled safe boundary", () => {
        const service = new BatchExecutionService();
        const result = service.templateResult({ id: "one", name: "One.psd" }, "CANCELLED", {
            autoSaveResult: { outputTransaction: transaction(State.COMMITTED, Cancellation.EFFECTIVE_AFTER_COMMIT) }
        });
        assert.strictEqual(result.outputRetryDisposition, Disposition.SKIP_DEFAULT);
        assert.strictEqual(result.outputTransactions.autoSave.commitState, State.COMMITTED);
        assert.strictEqual(Object.isFrozen(result.outputTransactions), true);
    });

    await test("committed cancellation counts as completed without claiming template success", async () => {
        const service = new BatchExecutionService();
        const template = { id: "one", name: "One.psd" };
        const batch = await service.execute({
            queue: { total: 1, descriptorAt: () => template },
            executeTemplate: async () => ({
                status: "CANCELLED",
                cancelledAtStage: "SAVING",
                autoSaveResult: {
                    outputTransaction: transaction(
                        State.COMMITTED,
                        Cancellation.EFFECTIVE_AFTER_COMMIT
                    )
                }
            })
        });
        assert.strictEqual(batch.status, "CANCELLED");
        assert.strictEqual(batch.completedTemplates, 1);
        assert.strictEqual(batch.successfulTemplates, 0);
        assert.strictEqual(batch.failedTemplates, 0);
        assert.strictEqual(batch.pendingTemplates, 0);
        assert.strictEqual(batch.cancelledAtStage, "SAVING");
    });

    await test("recovery completion excludes committed cancelled output from pending work", () => {
        const controller = recoveryController(new BatchRecoverySnapshot({
            projectId: "project",
            queueOrder: ["one", "two"],
            lifecycle: "RUNNING",
            pendingTemplateIds: ["one", "two"],
            selectedPhotoOrder: ["p1", "p2"]
        }));
        controller.updateRecoveryBatch({
            status: "CANCELLED", templateResults: [
                {
                    templateId: "one",
                    templateName: "One",
                    status: "CANCELLED",
                    autoSaveResult: {
                        outputTransaction: transaction(
                            State.COMMITTED,
                            Cancellation.EFFECTIVE_AFTER_COMMIT
                        )
                    },
                    photoAllocation: {
                        startCursor: 0,
                        endCursor: 1,
                        assignedCount: 1,
                        assignedPhotoIds: ["p1"],
                        remainingCount: 1,
                        status: "COMMITTED_AFTER_CANCEL"
                    }
                },
                { templateId: "two", templateName: "Two", status: "CANCELLED", autoSaveResult: { outputTransaction: transaction(State.CLEANED) } }
            ]
        });
        assert.deepStrictEqual(controller.batchRecoverySnapshot.completedTemplateIds, ["one"]);
        assert.deepStrictEqual(controller.batchRecoverySnapshot.pendingTemplateIds, ["two"]);
        assert.strictEqual(controller.batchRecoverySnapshot.photoCursor, 1);
        assert.deepStrictEqual(controller.batchRecoverySnapshot.consumedPhotoIds, ["p1"]);
        assert.deepStrictEqual(controller.batchRecoverySnapshot.remainingPhotoIds, ["p2"]);
        assert.strictEqual(controller.batchRecoverySnapshot.templateOutcomes[0].autosaveResult, undefined);
        assert.strictEqual(controller.batchRecoverySnapshot.templateOutcomes[0].outputTransactions.autoSave.commitState, State.COMMITTED);
    });

    await test("retry and resume queues omit blocked/remediation/committed outcomes", async () => {
        const snapshot = new BatchRecoverySnapshot({
            projectId: "project", queueOrder: ["retry", "blocked", "cleanup", "committed"],
            successfulTemplateIds: [], failedTemplateIds: ["retry", "blocked", "cleanup"], pendingTemplateIds: ["retry", "blocked", "cleanup"],
            selectedPhotoOrder: ["photo"], templateOutcomes: [
                { templateId: "retry", status: "FAILED", outputTransactions: snapshotTemplateOutputTransactions({ autoSaveResult: { outputTransaction: transaction(State.CLEANED) } }) },
                { templateId: "blocked", status: "FAILED", outputTransactions: snapshotTemplateOutputTransactions({ exportResult: { outputTransaction: transaction(State.COMMIT_UNKNOWN) } }) },
                { templateId: "cleanup", status: "FAILED", outputTransactions: snapshotTemplateOutputTransactions({ exportResult: { outputTransaction: transaction(State.CLEANUP_FAILED) } }) },
                { templateId: "committed", status: "CANCELLED", outputTransactions: snapshotTemplateOutputTransactions({ exportResult: { outputTransaction: transaction(State.COMMITTED, Cancellation.EFFECTIVE_AFTER_COMMIT) } }) }
            ]
        });
        const controller = recoveryController(snapshot);
        const retry = await controller.retryFailedTemplates();
        assert.deepStrictEqual(retry.templates.map(item => item.id), ["retry"]);
        const resume = await controller.resumeProjectBatch();
        assert.deepStrictEqual(resume.templates.map(item => item.id), ["retry"]);
    });
    console.info("ALB-045 Slice 5 cancellation/recovery/retry tests complete.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
