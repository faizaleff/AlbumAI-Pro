import {
    OutputTransactionState
} from "./OutputTransactionState";
import {
    TemplateOutputRetryDisposition,
    snapshotTemplateOutputTransactions,
    templateOutputRetryDisposition
} from "./OutputTransactionRecovery";

export const OutputOperatorState = Object.freeze({
    COMMITTED: "COMMITTED",
    SAFE_RETRY: "SAFE_RETRY",
    COMMIT_UNKNOWN: "COMMIT_UNKNOWN",
    REMEDIATION_REQUIRED: "REMEDIATION_REQUIRED"
});

const STATE_DETAILS = Object.freeze({
    [OutputOperatorState.COMMITTED]: Object.freeze({
        label: "Committed",
        message: "Output was verified and will be skipped by automatic retry."
    }),
    [OutputOperatorState.SAFE_RETRY]: Object.freeze({
        label: "Safe to retry",
        message: "No ambiguous committed output blocks automatic retry."
    }),
    [OutputOperatorState.COMMIT_UNKNOWN]: Object.freeze({
        label: "Commit unknown",
        message: "Automatic retry is blocked. Inspect the output before continuing."
    }),
    [OutputOperatorState.REMEDIATION_REQUIRED]: Object.freeze({
        label: "Cleanup required",
        message: "Automatic retry is blocked until retained output artifacts are remediated."
    })
});

function safeName(value, fallback) {
    if (typeof value !== "string" || !value.trim() || /[\\/]/.test(value)) return fallback;
    return value.trim();
}

function stateForTransaction(transaction) {
    if (transaction?.commitState === OutputTransactionState.COMMITTED) {
        return OutputOperatorState.COMMITTED;
    }
    if (transaction?.commitState === OutputTransactionState.CLEANUP_FAILED ||
        transaction?.remediationRequired === true) {
        return OutputOperatorState.REMEDIATION_REQUIRED;
    }
    if (transaction?.commitState === OutputTransactionState.COMMIT_UNKNOWN) {
        return OutputOperatorState.COMMIT_UNKNOWN;
    }
    return OutputOperatorState.SAFE_RETRY;
}

export function outputOperatorStateDetails(state) {
    return STATE_DETAILS[state] || STATE_DETAILS[OutputOperatorState.COMMIT_UNKNOWN];
}

function outputRows(outcome, index) {
    const templateName = safeName(
        outcome?.templateName,
        safeName(outcome?.templateId, `Template ${index + 1}`)
    );
    const transactions = outcome?.outputTransactions || {};
    const values = [
        ["Auto Save", transactions.autoSave],
        ["Export", transactions.export]
    ].filter(([, transaction]) => Boolean(transaction));
    if (!values.length && ["FAILED", "CANCELLED"].includes(outcome?.status)) {
        values.push(["Output", null]);
    }
    return values.map(([output, transaction]) => {
        const state = stateForTransaction(transaction);
        const details = outputOperatorStateDetails(state);
        return Object.freeze({
            templateId: outcome?.templateId ?? null,
            templateName,
            output,
            outputName: safeName(transaction?.displayName, "—"),
            state,
            label: details.label,
            message: details.message,
            reasonCode: transaction?.reasonCode || null
        });
    });
}

/** Safe, detached operator summary for recovery UI, completion UI, and logs. */
export function summarizeOutputRecovery(snapshot = {}) {
    const storedOutcomes = snapshot?.templateOutcomes || snapshot?.templateResults || [];
    const knownIds = new Set(storedOutcomes.map(item => item?.templateId));
    const pendingWithoutOutcome = (snapshot?.pendingTemplateIds || [])
        .filter(templateId => !knownIds.has(templateId))
        .map(templateId => ({ templateId, status: "CANCELLED" }));
    const outcomes = [...storedOutcomes, ...pendingWithoutOutcome].map(outcome => ({
        ...outcome,
        outputTransactions: snapshotTemplateOutputTransactions(outcome)
    }));
    const rows = outcomes.flatMap(outputRows);
    const counts = Object.fromEntries(Object.values(OutputOperatorState).map(state => [
        state,
        rows.filter(row => row.state === state).length
    ]));
    const dispositionCounts = {
        retry: 0,
        skip: 0,
        blocked: 0,
        remediation: 0
    };
    outcomes.forEach(outcome => {
        const disposition = templateOutputRetryDisposition(outcome);
        const actionable = ["FAILED", "CANCELLED"].includes(outcome?.status);
        if (disposition === TemplateOutputRetryDisposition.RETRY && actionable) dispositionCounts.retry += 1;
        else if (disposition === TemplateOutputRetryDisposition.SKIP_DEFAULT) dispositionCounts.skip += 1;
        else if (disposition === TemplateOutputRetryDisposition.REMEDIATION_REQUIRED && actionable) dispositionCounts.remediation += 1;
        else if (disposition === TemplateOutputRetryDisposition.BLOCKED && actionable) dispositionCounts.blocked += 1;
    });
    return Object.freeze({
        counts: Object.freeze(counts),
        rows: Object.freeze(rows),
        automaticRetryTemplates: dispositionCounts.retry,
        skippedCommittedTemplates: dispositionCounts.skip,
        blockedTemplates: dispositionCounts.blocked,
        remediationTemplates: dispositionCounts.remediation,
        automaticRetryBlocked: dispositionCounts.blocked > 0 || dispositionCounts.remediation > 0
    });
}

export function resolveBatchPanelOutputRecovery({ recoveryOutput, templateResults = [] } = {}) {
    if (recoveryOutput?.counts && Array.isArray(recoveryOutput?.rows)) {
        return recoveryOutput;
    }
    return summarizeOutputRecovery({ templateResults });
}
