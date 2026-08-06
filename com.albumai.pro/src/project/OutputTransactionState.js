export const OutputTransactionState = Object.freeze({
    NOT_STARTED: "NOT_STARTED",
    STAGING_CREATED: "STAGING_CREATED",
    HOST_WRITE_IN_PROGRESS: "HOST_WRITE_IN_PROGRESS",
    STAGED: "STAGED",
    VERIFIED: "VERIFIED",
    COMMITTED: "COMMITTED",
    CLEANED: "CLEANED",
    CLEANUP_FAILED: "CLEANUP_FAILED",
    COMMIT_UNKNOWN: "COMMIT_UNKNOWN"
});

export const OutputCancellationState = Object.freeze({
    NONE: "NONE",
    REQUESTED_BEFORE_WRITE: "REQUESTED_BEFORE_WRITE",
    REQUESTED_DURING_WRITE: "REQUESTED_DURING_WRITE",
    EFFECTIVE_AFTER_CLEANUP: "EFFECTIVE_AFTER_CLEANUP",
    EFFECTIVE_AFTER_COMMIT: "EFFECTIVE_AFTER_COMMIT"
});

export const OutputReasonCode = Object.freeze({
    STAGING_CREATE_FAILED: "STAGING_CREATE_FAILED",
    HOST_WRITE_FAILED: "HOST_WRITE_FAILED",
    STAGING_MISSING: "STAGING_MISSING",
    STAGING_EMPTY: "STAGING_EMPTY",
    STAGING_READ_FAILED: "STAGING_READ_FAILED",
    PROMOTION_FAILED: "PROMOTION_FAILED",
    EXISTING_OUTPUT_PRESERVE_FAILED: "EXISTING_OUTPUT_PRESERVE_FAILED",
    CLEANUP_FAILED: "CLEANUP_FAILED",
    COMMIT_VERIFICATION_FAILED: "COMMIT_VERIFICATION_FAILED",
    OVERWRITE_ORIGINAL_COMMITTED: "OVERWRITE_ORIGINAL_COMMITTED",
    CANCELLED_BEFORE_WRITE: "CANCELLED_BEFORE_WRITE",
    CANCELLED_AFTER_COMMIT: "CANCELLED_AFTER_COMMIT"
});

export const OutputKind = Object.freeze({
    AUTO_SAVE_PSD_COPY: "AUTO_SAVE_PSD_COPY",
    EXPORT_PSD: "EXPORT_PSD",
    EXPORT_JPEG: "EXPORT_JPEG",
    OVERWRITE_ORIGINAL: "OVERWRITE_ORIGINAL"
});

export const OutputRetryDisposition = Object.freeze({
    RETRY: "RETRY",
    SKIP_DEFAULT: "SKIP_DEFAULT",
    BLOCKED: "BLOCKED",
    REMEDIATION_REQUIRED: "REMEDIATION_REQUIRED"
});

const transactionStates = new Set(Object.values(OutputTransactionState));
const cancellationStates = new Set(Object.values(OutputCancellationState));
const reasonCodes = new Set(Object.values(OutputReasonCode));
const outputKinds = new Set(Object.values(OutputKind));

export function normalizeOutputTransactionState(value, {
    allowInProgress = false
} = {}) {
    if (!transactionStates.has(value)) return OutputTransactionState.COMMIT_UNKNOWN;
    if (!allowInProgress && value === OutputTransactionState.HOST_WRITE_IN_PROGRESS) {
        return OutputTransactionState.COMMIT_UNKNOWN;
    }
    return value;
}

export function normalizeOutputCancellationState(value) {
    return cancellationStates.has(value)
        ? value
        : OutputCancellationState.NONE;
}

export function normalizeOutputReasonCode(value) {
    return reasonCodes.has(value) ? value : null;
}

export function normalizeOutputKind(value) {
    return outputKinds.has(value) ? value : null;
}

export function isOutputTransactionTerminal(value) {
    const state = normalizeOutputTransactionState(value, { allowInProgress: true });
    return [
        OutputTransactionState.NOT_STARTED,
        OutputTransactionState.COMMITTED,
        OutputTransactionState.CLEANED,
        OutputTransactionState.CLEANUP_FAILED,
        OutputTransactionState.COMMIT_UNKNOWN
    ].includes(state);
}

export function isOutputCommitted(value) {
    return normalizeOutputTransactionState(value, { allowInProgress: true }) ===
        OutputTransactionState.COMMITTED;
}
