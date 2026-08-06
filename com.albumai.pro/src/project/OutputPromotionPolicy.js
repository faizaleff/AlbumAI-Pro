import {
    OutputReasonCode,
    OutputTransactionState
} from "./OutputTransactionState";
import {
    classifyCleanupFailure,
    classifyUnknownCommitState,
    createOutputTransactionResult
} from "./OutputTransactionPolicy";
import { createUniqueStaging, outputBackupName } from "./OutputStaging";

export const OutputPromotionStrategy = Object.freeze({
    PROMOTE_DIRECT: "PROMOTE_DIRECT",
    PRESERVE_THEN_PROMOTE: "PRESERVE_THEN_PROMOTE",
    RETAIN_STAGING_AND_BLOCK: "RETAIN_STAGING_AND_BLOCK",
    COMMIT_UNKNOWN: "COMMIT_UNKNOWN"
});

export function planOutputPromotion({ finalExists, finalLookupKnown = true, capabilities = {} } = {}) {
    if (!finalLookupKnown) return Object.freeze({ strategy: OutputPromotionStrategy.COMMIT_UNKNOWN });
    const canPromote = capabilities.canRenameSameFolder || capabilities.canMoveSameFolder;
    if (!canPromote) return Object.freeze({ strategy: OutputPromotionStrategy.RETAIN_STAGING_AND_BLOCK });
    if (!finalExists || capabilities.canReplaceExisting) {
        return Object.freeze({ strategy: OutputPromotionStrategy.PROMOTE_DIRECT });
    }
    return Object.freeze({ strategy: OutputPromotionStrategy.PRESERVE_THEN_PROMOTE });
}

async function clean(adapter, entry) {
    try { await adapter.deleteEntry(entry); return true; } catch (_) { return false; }
}

function failedAfterCleanup(adapter, staging, data, reasonCode) {
    return clean(adapter, staging).then(cleaned => cleaned
        ? createOutputTransactionResult({ ...data, commitState: OutputTransactionState.CLEANED, reasonCode })
        : classifyCleanupFailure(data));
}

/** Purely injected transaction orchestration; no Photoshop operation is owned here. */
export async function runOutputPromotionTransaction({
    adapter,
    finalName,
    displayName,
    outputKind,
    transactionId,
    writeStaging,
    verify,
    maxAttempts
} = {}) {
    const data = { displayName, outputKind };
    const staged = await createUniqueStaging(adapter, { finalName, transactionId, maxAttempts });
    if (!staged.entry) {
        return createOutputTransactionResult({ ...data, commitState: OutputTransactionState.NOT_STARTED, reasonCode: OutputReasonCode.STAGING_CREATE_FAILED });
    }
    if (typeof writeStaging === "function") {
        try { await writeStaging(staged.entry); } catch (_) {
            return failedAfterCleanup(adapter, staged.entry, data, OutputReasonCode.HOST_WRITE_FAILED);
        }
    }
    const stagedVerification = await verify(adapter, staged.entry);
    if (!stagedVerification?.valid) {
        return failedAfterCleanup(adapter, staged.entry, data, stagedVerification?.reasonCode || OutputReasonCode.COMMIT_VERIFICATION_FAILED);
    }
    let final;
    try { final = await adapter.findEntry(finalName); } catch (_) {
        return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.PROMOTION_FAILED });
    }
    const plan = planOutputPromotion({ finalExists: Boolean(final), capabilities: adapter.capabilityReport(staged.entry) });
    if (plan.strategy === OutputPromotionStrategy.RETAIN_STAGING_AND_BLOCK || plan.strategy === OutputPromotionStrategy.COMMIT_UNKNOWN) {
        return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.PROMOTION_FAILED });
    }
    let backup = null;
    if (plan.strategy === OutputPromotionStrategy.PRESERVE_THEN_PROMOTE) {
        const backupName = outputBackupName({ finalName, transactionId });
        try {
            await adapter.promoteEntry(final, backupName, { overwrite: false });
            backup = await adapter.findEntry(backupName);
            if (!backup) throw new Error("Backup could not be resolved.");
        } catch (_) {
            return failedAfterCleanup(adapter, staged.entry, data, OutputReasonCode.EXISTING_OUTPUT_PRESERVE_FAILED);
        }
    }
    try { await adapter.promoteEntry(staged.entry, finalName, { overwrite: false }); } catch (_) {
        if (backup) {
            try { await adapter.promoteEntry(backup, finalName, { overwrite: false }); } catch (_) {
                return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.PROMOTION_FAILED });
            }
        }
        return failedAfterCleanup(adapter, staged.entry, data, OutputReasonCode.PROMOTION_FAILED);
    }
    let committed;
    try { committed = await adapter.findEntry(finalName); } catch (_) {
        return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.COMMIT_VERIFICATION_FAILED });
    }
    const finalVerification = await verify(adapter, committed);
    if (!finalVerification?.valid) {
        if (backup) {
            try { await adapter.promoteEntry(backup, finalName, { overwrite: false }); } catch (_) {
                return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.COMMIT_VERIFICATION_FAILED });
            }
        }
        return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.COMMIT_VERIFICATION_FAILED });
    }
    if (backup && !await clean(adapter, backup)) {
        return createOutputTransactionResult({ ...data, commitState: OutputTransactionState.COMMITTED, reasonCode: OutputReasonCode.CLEANUP_FAILED });
    }
    return createOutputTransactionResult({ ...data, commitState: OutputTransactionState.COMMITTED });
}
