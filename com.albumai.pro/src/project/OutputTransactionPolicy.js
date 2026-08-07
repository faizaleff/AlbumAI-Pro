import {
    OutputCancellationState,
    OutputKind,
    OutputReasonCode,
    OutputRetryDisposition,
    OutputTransactionState,
    isOutputCommitted,
    isOutputTransactionTerminal,
    normalizeOutputCancellationState,
    normalizeOutputKind,
    normalizeOutputReasonCode,
    normalizeOutputTransactionState
} from "./OutputTransactionState";

export const OutputTransactionStatus = Object.freeze({
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    REMEDIATION_REQUIRED: "REMEDIATION_REQUIRED",
    COMMIT_UNKNOWN: "COMMIT_UNKNOWN"
});

function safeDisplayName(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return trimmed && !/[\\/]/.test(trimmed) ? trimmed : "";
}

export function retryDispositionForOutput({ commitState, cancellationState } = {}) {
    const state = normalizeOutputTransactionState(commitState, { allowInProgress: true });
    const cancellation = normalizeOutputCancellationState(cancellationState);

    if (state === OutputTransactionState.CLEANUP_FAILED) {
        return OutputRetryDisposition.REMEDIATION_REQUIRED;
    }
    if (state === OutputTransactionState.COMMIT_UNKNOWN ||
        state === OutputTransactionState.HOST_WRITE_IN_PROGRESS) {
        return OutputRetryDisposition.BLOCKED;
    }
    if (state === OutputTransactionState.COMMITTED ||
        cancellation === OutputCancellationState.EFFECTIVE_AFTER_COMMIT) {
        return OutputRetryDisposition.SKIP_DEFAULT;
    }
    return OutputRetryDisposition.RETRY;
}

export function isAutomaticRetryAllowed(value) {
    return retryDispositionForOutput(value) === OutputRetryDisposition.RETRY;
}

export function isAutomaticRetryBlocked(value) {
    return [
        OutputRetryDisposition.BLOCKED,
        OutputRetryDisposition.REMEDIATION_REQUIRED
    ].includes(retryDispositionForOutput(value));
}

export function requiresOutputRemediation(value) {
    return retryDispositionForOutput(value) ===
        OutputRetryDisposition.REMEDIATION_REQUIRED;
}

export function canCancellationBecomeEffectiveAtBoundary({
    commitState,
    boundary
} = {}) {
    const state = normalizeOutputTransactionState(commitState, { allowInProgress: true });
    if (state === OutputTransactionState.HOST_WRITE_IN_PROGRESS ||
        boundary === "DURING_HOST_WRITE") {
        return false;
    }
    return [
        "BEFORE_STAGING",
        "AFTER_STAGING_BEFORE_HOST_WRITE",
        "AFTER_HOST_WRITE_BEFORE_VERIFICATION",
        "AFTER_VERIFICATION_BEFORE_PROMOTION",
        "AFTER_COMMIT",
        "DURING_CLEANUP"
    ].includes(boundary) && isOutputTransactionTerminal(state);
}

function statusFor({ commitState, cancellationState, reasonCode }) {
    if (commitState === OutputTransactionState.COMMIT_UNKNOWN) {
        return OutputTransactionStatus.COMMIT_UNKNOWN;
    }
    if (commitState === OutputTransactionState.CLEANUP_FAILED) {
        return OutputTransactionStatus.REMEDIATION_REQUIRED;
    }
    if (cancellationState !== OutputCancellationState.NONE ||
        reasonCode === OutputReasonCode.CANCELLED_BEFORE_WRITE ||
        reasonCode === OutputReasonCode.CANCELLED_AFTER_COMMIT) {
        return OutputTransactionStatus.CANCELLED;
    }
    if (commitState === OutputTransactionState.COMMITTED) {
        return OutputTransactionStatus.COMPLETED;
    }
    if (commitState === OutputTransactionState.NOT_STARTED ||
        commitState === OutputTransactionState.HOST_WRITE_IN_PROGRESS) {
        return OutputTransactionStatus.PENDING;
    }
    return OutputTransactionStatus.FAILED;
}

function normalizedState(data, allowInProgress) {
    const rawState = data?.commitState;
    const legacySuccess = data?.status === "SAVED" || data?.status === "SUCCESS";
    if (rawState == null && legacySuccess) return OutputTransactionState.COMMIT_UNKNOWN;
    return normalizeOutputTransactionState(
        rawState == null ? OutputTransactionState.NOT_STARTED : rawState,
        { allowInProgress }
    );
}

export function normalizeOutputTransactionResult(data = {}, {
    allowInProgress = false
} = {}) {
    const commitState = normalizedState(data, allowInProgress);
    const cancellationState = normalizeOutputCancellationState(data?.cancellationState);
    const reasonCode = normalizeOutputReasonCode(data?.reasonCode);
    const outputKind = normalizeOutputKind(data?.outputKind);
    const overwriteOriginal = outputKind === OutputKind.OVERWRITE_ORIGINAL ||
        data?.overwriteOriginal === true;
    const retryDisposition = retryDispositionForOutput({ commitState, cancellationState });

    return Object.freeze({
        status: statusFor({ commitState, cancellationState, reasonCode }),
        commitState,
        cancellationState,
        reasonCode,
        displayName: safeDisplayName(data?.displayName),
        outputKind,
        overwriteOriginal,
        retryDisposition,
        remediationRequired: retryDisposition === OutputRetryDisposition.REMEDIATION_REQUIRED ||
            reasonCode === OutputReasonCode.CLEANUP_FAILED
    });
}

export const createOutputTransactionResult = normalizeOutputTransactionResult;

export function serializeOutputTransactionResult(data = {}) {
    // An active host write cannot be persisted as a recoverable terminal fact.
    return normalizeOutputTransactionResult(data, { allowInProgress: false });
}

export function classifyCancellationBeforeStaging(data = {}) {
    return createOutputTransactionResult({
        ...data,
        commitState: OutputTransactionState.NOT_STARTED,
        cancellationState: OutputCancellationState.REQUESTED_BEFORE_WRITE,
        reasonCode: OutputReasonCode.CANCELLED_BEFORE_WRITE
    });
}

export function classifyCancellationAfterStagingBeforeHostWrite(data = {}) {
    if (data.cleanupSucceeded === false) return classifyCleanupFailure(data);
    return createOutputTransactionResult({
        ...data,
        commitState: OutputTransactionState.CLEANED,
        cancellationState: OutputCancellationState.EFFECTIVE_AFTER_CLEANUP,
        reasonCode: data.reasonCode || OutputReasonCode.CANCELLED_BEFORE_WRITE
    });
}

export function classifyCancellationDuringHostWrite(data = {}) {
    return normalizeOutputTransactionResult({
        ...data,
        commitState: OutputTransactionState.HOST_WRITE_IN_PROGRESS,
        cancellationState: OutputCancellationState.REQUESTED_DURING_WRITE
    }, { allowInProgress: true });
}

export function classifyCancellationAfterHostWriteBeforeVerification(data = {}) {
    return classifyCancellationAfterStagingBeforeHostWrite(data);
}

export function classifyCancellationAfterVerificationBeforePromotion(data = {}) {
    return classifyCancellationAfterStagingBeforeHostWrite(data);
}

export function classifyCancellationAfterCommit(data = {}) {
    return createOutputTransactionResult({
        ...data,
        commitState: OutputTransactionState.COMMITTED,
        cancellationState: OutputCancellationState.EFFECTIVE_AFTER_COMMIT,
        reasonCode: OutputReasonCode.CANCELLED_AFTER_COMMIT
    });
}

export function classifyCleanupFailure(data = {}) {
    return createOutputTransactionResult({
        ...data,
        commitState: OutputTransactionState.CLEANUP_FAILED,
        reasonCode: OutputReasonCode.CLEANUP_FAILED
    });
}

export function classifyUnknownCommitState(data = {}) {
    return createOutputTransactionResult({
        ...data,
        commitState: OutputTransactionState.COMMIT_UNKNOWN,
        reasonCode: data.reasonCode || OutputReasonCode.COMMIT_VERIFICATION_FAILED
    });
}

export { isOutputCommitted, isOutputTransactionTerminal };
