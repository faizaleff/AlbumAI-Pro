import {
    OutputRetryDisposition
} from "./OutputTransactionState";
import {
    isAutomaticRetryBlocked,
    requiresOutputRemediation,
    serializeOutputTransactionResult
} from "./OutputTransactionPolicy";

export const TemplateOutputRetryDisposition = Object.freeze({
    RETRY: "RETRY",
    SKIP_DEFAULT: "SKIP_DEFAULT",
    BLOCKED: "BLOCKED",
    REMEDIATION_REQUIRED: "REMEDIATION_REQUIRED"
});

function outputSnapshot(result) {
    if (!result || typeof result !== "object") return null;
    const transaction = result.outputTransaction;
    if (transaction && typeof transaction === "object") {
        return serializeOutputTransactionResult(transaction);
    }
    if (result.commitState != null || result.cancellationState != null) {
        return serializeOutputTransactionResult(result);
    }
    // A legacy success claimed an output but has no durable transaction fact.
    // Normalize fail-closed rather than inferring a committed final from a path.
    if (["SAVED", "SUCCESS"].includes(result.status)) {
        return serializeOutputTransactionResult(result);
    }
    return null;
}

/** Produces detached, safe output facts suitable for recovery JSON. */
export function snapshotTemplateOutputTransactions({
    autoSaveResult,
    exportResult,
    outputTransactions = null
} = {}) {
    return Object.freeze({
        autoSave: outputSnapshot(autoSaveResult) || outputSnapshot(outputTransactions?.autoSave),
        export: outputSnapshot(exportResult) || outputSnapshot(outputTransactions?.export)
    });
}

export function templateOutputRetryDisposition({ status, outputTransactions } = {}) {
    const transactions = Object.values(outputTransactions || {}).filter(Boolean);
    if (transactions.some(requiresOutputRemediation)) {
        return TemplateOutputRetryDisposition.REMEDIATION_REQUIRED;
    }
    if (transactions.some(isAutomaticRetryBlocked)) {
        return TemplateOutputRetryDisposition.BLOCKED;
    }
    if (transactions.length > 0 && transactions.every(item =>
        item.retryDisposition === OutputRetryDisposition.SKIP_DEFAULT
    )) {
        return TemplateOutputRetryDisposition.SKIP_DEFAULT;
    }
    // A missing output fact is not evidence of a final. Preserve existing
    // interrupted/failed retry behavior unless policy explicitly blocks it.
    return TemplateOutputRetryDisposition.RETRY;
}

export function canAutomaticallyRetryTemplateOutcome(outcome = {}) {
    return templateOutputRetryDisposition(outcome) ===
        TemplateOutputRetryDisposition.RETRY;
}

export function isTemplateOutputCompleteByDefault(outcome = {}) {
    return templateOutputRetryDisposition(outcome) ===
        TemplateOutputRetryDisposition.SKIP_DEFAULT;
}
