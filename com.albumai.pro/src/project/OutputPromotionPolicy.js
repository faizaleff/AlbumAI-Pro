import {
    OutputReasonCode,
    OutputTransactionState
} from "./OutputTransactionState";
import {
    classifyCancellationAfterCommit,
    classifyCancellationAfterStagingBeforeHostWrite,
    classifyCancellationBeforeStaging,
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
    maxAttempts,
    isCancellationRequested = () => false,
    onDiagnostic = null
} = {}) {
    const data = { displayName, outputKind };
    const cancelled = () => isCancellationRequested?.() === true;
    const diagnostic = event => onDiagnostic?.(event);
    if (cancelled()) {
        diagnostic("CANCELLED_BEFORE_STAGING");
        return classifyCancellationBeforeStaging(data);
    }
    diagnostic("TRANSACTION_BEGIN");
    const staged = await createUniqueStaging(adapter, { finalName, transactionId, maxAttempts });
    if (!staged.entry) {
        return createOutputTransactionResult({ ...data, commitState: OutputTransactionState.NOT_STARTED, reasonCode: OutputReasonCode.STAGING_CREATE_FAILED });
    }
    diagnostic("STAGING_CREATED");
    if (cancelled()) {
        const cleaned = await clean(adapter, staged.entry);
        diagnostic(cleaned ? "STAGING_CLEANED" : "STAGING_CLEANUP_FAILED");
        return cleaned
            ? classifyCancellationAfterStagingBeforeHostWrite(data)
            : classifyCleanupFailure(data);
    }
    if (typeof writeStaging === "function") {
        try {
            diagnostic("HOST_WRITE_BEGIN");
            await writeStaging(staged.entry);
            diagnostic("HOST_WRITE_END");
        } catch (_) {
            return failedAfterCleanup(adapter, staged.entry, data, OutputReasonCode.HOST_WRITE_FAILED);
        }
    }
    const stagedVerification = await verify(adapter, staged.entry);
    if (!stagedVerification?.valid) {
        return failedAfterCleanup(adapter, staged.entry, data, stagedVerification?.reasonCode || OutputReasonCode.COMMIT_VERIFICATION_FAILED);
    }
    diagnostic("STAGING_VERIFIED");
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
            diagnostic("PRIOR_FINAL_PRESERVED");
        } catch (_) {
            return failedAfterCleanup(adapter, staged.entry, data, OutputReasonCode.EXISTING_OUTPUT_PRESERVE_FAILED);
        }
    }
    try {
        diagnostic("PROMOTION_BEGIN");
        await adapter.promoteEntry(staged.entry, finalName, { overwrite: false });
        diagnostic("PROMOTION_END");
    } catch (_) {
        diagnostic("PROMOTION_FAILED");
        if (backup) {
            try {
                diagnostic("ROLLBACK_BEGIN");
                await adapter.promoteEntry(backup, finalName, { overwrite: false });
                diagnostic("ROLLBACK_DONE");
            } catch (_) {
                diagnostic("ROLLBACK_FAILED");
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
            try {
                diagnostic("ROLLBACK_BEGIN");
                await adapter.promoteEntry(backup, finalName, { overwrite: false });
                const restored = await adapter.findEntry(finalName);
                const restoredVerification = await verify(adapter, restored);
                if (!restoredVerification?.valid) throw new Error("Rollback verification failed.");
                diagnostic("ROLLBACK_DONE");
                return createOutputTransactionResult({
                    ...data,
                    commitState: OutputTransactionState.CLEANED,
                    reasonCode: OutputReasonCode.COMMIT_VERIFICATION_FAILED
                });
            } catch (_) {
                diagnostic("ROLLBACK_FAILED");
                return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.COMMIT_VERIFICATION_FAILED });
            }
        }
        return classifyUnknownCommitState({ ...data, reasonCode: OutputReasonCode.COMMIT_VERIFICATION_FAILED });
    }
    diagnostic("FINAL_VERIFIED");
    if (backup && !await clean(adapter, backup)) {
        diagnostic("BACKUP_CLEANUP_FAILED");
        return createOutputTransactionResult({ ...data, commitState: OutputTransactionState.COMMITTED, reasonCode: OutputReasonCode.CLEANUP_FAILED });
    }
    if (backup) diagnostic("BACKUP_CLEANED");
    const result = cancelled()
        ? classifyCancellationAfterCommit(data)
        : createOutputTransactionResult({ ...data, commitState: OutputTransactionState.COMMITTED });
    diagnostic(`TERMINAL_${result.commitState}`);
    return result;
}
