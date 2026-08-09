import assert from "assert";
import {
    OutputCancellationState as Cancellation,
    OutputKind,
    OutputReasonCode as Reason,
    OutputRetryDisposition as Retry,
    OutputTransactionState as State,
    isOutputCommitted,
    isOutputTransactionTerminal,
    normalizeOutputCancellationState,
    normalizeOutputReasonCode,
    normalizeOutputTransactionState
} from "../src/project/OutputTransactionState";
import {
    canCancellationBecomeEffectiveAtBoundary,
    classifyCancellationAfterCommit,
    classifyCancellationAfterHostWriteBeforeVerification,
    classifyCancellationAfterStagingBeforeHostWrite,
    classifyCancellationAfterVerificationBeforePromotion,
    classifyCancellationBeforeStaging,
    classifyCancellationDuringHostWrite,
    classifyCleanupFailure,
    classifyUnknownCommitState,
    createOutputTransactionResult,
    isAutomaticRetryAllowed,
    isAutomaticRetryBlocked,
    normalizeOutputTransactionResult,
    requiresOutputRemediation,
    retryDispositionForOutput,
    serializeOutputTransactionResult
} from "../src/project/OutputTransactionPolicy";

function test(name, callback) {
    try {
        callback();
        console.info(`PASS ALB-045: ${name}`);
    } catch (error) {
        console.error(`FAIL ALB-045: ${name}`);
        throw error;
    }
}

Object.values(State).forEach(state => test(`normalizes state ${state}`, () => {
    assert.strictEqual(normalizeOutputTransactionState(state, { allowInProgress: true }), state);
}));

test("unknown states fail closed", () => {
    assert.strictEqual(normalizeOutputTransactionState("legacy"), State.COMMIT_UNKNOWN);
    assert.strictEqual(normalizeOutputCancellationState("legacy"), Cancellation.NONE);
    assert.strictEqual(normalizeOutputReasonCode("legacy"), null);
});

test("terminal and committed detection are exact", () => {
    [State.NOT_STARTED, State.COMMITTED, State.CLEANED, State.CLEANUP_FAILED, State.COMMIT_UNKNOWN]
        .forEach(state => assert.strictEqual(isOutputTransactionTerminal(state), true));
    [State.STAGING_CREATED, State.HOST_WRITE_IN_PROGRESS, State.STAGED, State.VERIFIED]
        .forEach(state => assert.strictEqual(isOutputTransactionTerminal(state), false));
    assert.strictEqual(isOutputCommitted(State.COMMITTED), true);
    assert.strictEqual(isOutputCommitted(State.COMMIT_UNKNOWN), false);
});

test("retry and remediation matrix is deterministic", () => {
    assert.strictEqual(retryDispositionForOutput({ commitState: State.NOT_STARTED }), Retry.RETRY);
    assert.strictEqual(retryDispositionForOutput({ commitState: State.CLEANED }), Retry.RETRY);
    assert.strictEqual(retryDispositionForOutput({ commitState: State.COMMITTED }), Retry.SKIP_DEFAULT);
    assert.strictEqual(retryDispositionForOutput({ commitState: State.COMMITTED, cancellationState: Cancellation.EFFECTIVE_AFTER_COMMIT }), Retry.SKIP_DEFAULT);
    assert.strictEqual(retryDispositionForOutput({ commitState: State.CLEANUP_FAILED }), Retry.REMEDIATION_REQUIRED);
    assert.strictEqual(retryDispositionForOutput({ commitState: State.COMMIT_UNKNOWN }), Retry.BLOCKED);
    assert.strictEqual(isAutomaticRetryAllowed({ commitState: State.CLEANED }), true);
    assert.strictEqual(isAutomaticRetryBlocked({ commitState: State.COMMIT_UNKNOWN }), true);
    assert.strictEqual(requiresOutputRemediation({ commitState: State.CLEANUP_FAILED }), true);
});

test("every cancellation boundary has a deterministic classification", () => {
    assert.deepStrictEqual(classifyCancellationBeforeStaging().commitState, State.NOT_STARTED);
    assert.deepStrictEqual(classifyCancellationAfterStagingBeforeHostWrite().commitState, State.CLEANED);
    assert.deepStrictEqual(classifyCancellationDuringHostWrite().commitState, State.HOST_WRITE_IN_PROGRESS);
    assert.deepStrictEqual(classifyCancellationAfterHostWriteBeforeVerification().commitState, State.CLEANED);
    assert.deepStrictEqual(classifyCancellationAfterVerificationBeforePromotion().commitState, State.CLEANED);
    assert.deepStrictEqual(classifyCancellationAfterCommit().commitState, State.COMMITTED);
    assert.strictEqual(classifyCancellationAfterCommit().cancellationState, Cancellation.EFFECTIVE_AFTER_COMMIT);
});

test("host-write cancellation cannot become effective until terminal", () => {
    assert.strictEqual(canCancellationBecomeEffectiveAtBoundary({ commitState: State.HOST_WRITE_IN_PROGRESS, boundary: "DURING_HOST_WRITE" }), false);
    assert.strictEqual(canCancellationBecomeEffectiveAtBoundary({ commitState: State.NOT_STARTED, boundary: "BEFORE_STAGING" }), true);
    assert.strictEqual(canCancellationBecomeEffectiveAtBoundary({ commitState: State.COMMITTED, boundary: "AFTER_COMMIT" }), true);
});

test("cleanup and unknown commit states block unsafe automatic work", () => {
    const cleanup = classifyCleanupFailure();
    const unknown = classifyUnknownCommitState();
    assert.strictEqual(cleanup.reasonCode, Reason.CLEANUP_FAILED);
    assert.strictEqual(cleanup.remediationRequired, true);
    assert.strictEqual(unknown.commitState, State.COMMIT_UNKNOWN);
    assert.strictEqual(unknown.retryDisposition, Retry.BLOCKED);
});

test("legacy success is not guessed committed", () => {
    const legacy = normalizeOutputTransactionResult({ status: "SAVED", outputPath: "/secret/file.psd" });
    assert.strictEqual(legacy.commitState, State.COMMIT_UNKNOWN);
    assert.strictEqual(legacy.retryDisposition, Retry.BLOCKED);
    assert.strictEqual("outputPath" in legacy, false);
});

test("result normalization is safe, serializable, and immutable", () => {
    const input = {
        commitState: State.COMMITTED,
        cancellationState: Cancellation.EFFECTIVE_AFTER_COMMIT,
        reasonCode: Reason.CANCELLED_AFTER_COMMIT,
        displayName: "album.psd",
        outputKind: OutputKind.AUTO_SAVE_PSD_COPY,
        nativePath: "/secret/album.psd",
        token: "secret",
        entry: { delete() {} },
        error: new Error("secret")
    };
    const result = createOutputTransactionResult(input);
    assert(Object.isFrozen(result));
    assert.strictEqual(result.displayName, "album.psd");
    assert.strictEqual(result.retryDisposition, Retry.SKIP_DEFAULT);
    assert.deepStrictEqual(Object.keys(result).sort(), [
        "cancellationState", "commitState", "displayName", "outputKind",
        "overwriteOriginal", "reasonCode", "remediationRequired",
        "retryDisposition", "status"
    ]);
    assert.strictEqual(JSON.stringify(result).includes("secret"), false);
    assert.strictEqual(input.entry.delete instanceof Function, true);
    assert.strictEqual(input.commitState, State.COMMITTED);
});

test("unsafe display names and active writes cannot serialize as success", () => {
    const active = classifyCancellationDuringHostWrite({ displayName: "/secret/file.psd" });
    const serialized = serializeOutputTransactionResult(active);
    assert.strictEqual(active.commitState, State.HOST_WRITE_IN_PROGRESS);
    assert.strictEqual(serialized.commitState, State.COMMIT_UNKNOWN);
    assert.strictEqual(serialized.displayName, "");
    assert.strictEqual(serialized.retryDisposition, Retry.BLOCKED);
});

console.info("ALB-045 output transaction policy tests complete.");
