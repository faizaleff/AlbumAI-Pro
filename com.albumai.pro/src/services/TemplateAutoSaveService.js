import DocumentManager from "../core/document/DocumentManager";
import Logger from "../core/photoshop/Logger";
import AutoSaveResult, { AutoSaveStatus } from "./AutoSaveResult";
import { storage } from "uxp";
import OutputTransactionFileAdapter from "../project/OutputTransactionFileAdapter";
import { runOutputPromotionTransaction } from "../project/OutputPromotionPolicy";
import { OutputKind } from "../project/OutputTransactionState";
import { OutputTransactionStatus } from "../project/OutputTransactionPolicy";
import { OutputVerificationFormat, verifyOutputEntry } from "../project/OutputVerification";

export const AutoSaveMode = Object.freeze({
    SAVE_COPY: "SAVE_COPY",
    OVERWRITE_ORIGINAL: "OVERWRITE_ORIGINAL"
});

/** Saves only a verified, successfully processed parent PSD document. */
export default class TemplateAutoSaveService {

    constructor({
        documentManager = new DocumentManager(),
        fileAdapterFactory = options => new OutputTransactionFileAdapter(options),
        transactionRunner = runOutputPromotionTransaction,
        afterOverwriteOriginalHostCommit = null,
        transactionId = () => typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `save-${Date.now()}-${Math.random()}`
    } = {}) {

        this.documentManager = documentManager;
        this.fileAdapterFactory = fileAdapterFactory;
        this.transactionRunner = transactionRunner;
        this.afterOverwriteOriginalHostCommit = afterOverwriteOriginalHostCommit;
        this.transactionId = transactionId;
        this.inFlight = new Map();

    }

    save(options = {}) {

        const documentId = options.documentContext?.documentId ??
            options.template?.document?.id ?? "unknown";
        const templateId = options.descriptor?.id ?? options.template?.id ??
            options.descriptor?.name ?? options.template?.name ?? "unknown";
        const key = `${documentId}:${templateId}:${options.mode || AutoSaveMode.SAVE_COPY}`;
        if (this.inFlight.has(key)) {
            return this.inFlight.get(key);
        }

        const pending = this.performSave(options).finally(() => {
            if (this.inFlight.get(key) === pending) {
                this.inFlight.delete(key);
            }
        });
        this.inFlight.set(key, pending);
        return pending;

    }

    async performSave({
        project,
        template,
        descriptor,
        documentContext,
        executionSummary,
        enabled = false,
        mode = AutoSaveMode.SAVE_COPY,
        cancellationController = null
    } = {}) {

        const resultData = {
            templateId: template?.id ?? null,
            documentId: template?.document?.id ?? null,
            mode,
            sourcePath: template?.filePath || ""
        };

        if (!enabled) {
            return this.skipped(resultData, "Auto Save is disabled.");
        }

        if (!this.isSuccessful(executionSummary)) {
            return this.skipped(resultData, "Auto Save skipped because replacement did not complete successfully.");
        }

        if (!this.isMode(mode)) {
            return this.skipped(resultData, "Auto Save mode is unavailable.");
        }

        const documentId = documentContext?.documentId ?? template?.document?.id;
        const document = this.documentManager.byId(documentId);

        if (!document) {
            return this.skipped(resultData, "Template document is not active.");
        }
        await this.documentManager.activate(document);
        Logger.info(`ACTIVE DOCUMENT BEFORE SAVE: ${this.documentManager.activeId}/${document.title}`);

        if (this.isPsb(template, document)) {
            return this.skipped(resultData, "Auto Save does not save Smart Object documents.");
        }

        try {

            if (mode === AutoSaveMode.OVERWRITE_ORIGINAL) {
                if (this.cancelled(cancellationController)) {
                    return this.transactionResult(resultData, AutoSaveStatus.SKIPPED, null, {
                        status: "CANCELLED", commitState: "NOT_STARTED",
                        cancellationState: "REQUESTED_BEFORE_WRITE",
                        reasonCode: "CANCELLED_BEFORE_WRITE", displayName: "",
                        outputKind: OutputKind.OVERWRITE_ORIGINAL, overwriteOriginal: true,
                        retryDisposition: "RETRY", remediationRequired: false
                    });
                }
                await this.documentManager.save(document);
                try {
                    await this.afterOverwriteOriginalHostCommit?.({
                        isCancellationRequested: () => this.cancelled(cancellationController)
                    });
                } catch (_) {
                    // A runtime diagnostic hook must never obscure a host save
                    // that has already committed the original document.
                    Logger.warn("RT-14 post-commit diagnostic gate failed.");
                }

                const outputTransaction = {
                    status: "COMPLETED", commitState: "COMMITTED",
                    cancellationState: this.cancelled(cancellationController)
                        ? "EFFECTIVE_AFTER_COMMIT" : "NONE",
                    reasonCode: "OVERWRITE_ORIGINAL_COMMITTED",
                    displayName: this.baseName(document.title || template?.name || "template") + ".psd",
                    outputKind: OutputKind.OVERWRITE_ORIGINAL, overwriteOriginal: true,
                    retryDisposition: "SKIP_DEFAULT", remediationRequired: false
                };
                return this.transactionResult(resultData, AutoSaveStatus.SAVED,
                    resultData.sourcePath || document.title || "", outputTransaction);
            }

            return this.saveCopy({ project, template, descriptor, document, resultData, cancellationController });

        }

        catch (_) {

            Logger.warn("Auto Save failed.");

            return new AutoSaveResult({
                ...resultData,
                status: AutoSaveStatus.FAILED,
                error: "Auto Save failed."
            });

        }

    }

    isSuccessful(summary) {

        return !!summary &&
            summary.failedSteps === 0 &&
            summary.completedSteps > 0 &&
            summary.status === "COMPLETED";

    }

    isMode(mode) {

        return Object.values(AutoSaveMode).includes(mode);

    }

    isPsb(template, document) {

        return /\.psb$/i.test(template?.filePath || "") ||
            /\.psb$/i.test(template?.name || "") ||
            /\.psb$/i.test(document?.title || "");

    }

    async copyDestination(project, template, document, descriptor = null) {

        const output = project?.workspace?.output;

        if (!output?.isFolder) {
            throw new Error("Project output folder is unavailable.");
        }

        const entries = await output.getEntries();
        let processed = entries.find(entry =>
            entry.isFolder && entry.name === "Processed"
        );

        if (!processed) {
            processed = await output.createFolder("Processed");
        }

        const baseName = this.baseName(descriptor?.name || template?.name || document?.title || "template");

        return Object.freeze({
            folder: processed,
            finalName: `${baseName}.psd`,
            displayName: `${baseName}.psd`
        });

    }

    baseName(name) {

        return String(name).replace(/\.[^.]+$/, "") || "template";

    }

    skipped(data, warning) {

        return new AutoSaveResult({
            ...data,
            status: AutoSaveStatus.SKIPPED,
            warnings: [warning]
        });

    }

    async saveCopy({ project, template, descriptor, document, resultData, cancellationController }) {
        const target = await this.copyDestination(project, template, document, descriptor);
        const adapter = this.fileAdapterFactory({
            folder: target.folder,
            // The locked host characterization found binary ArrayBuffer reads
            // but no bounded header read. PSDs may therefore be read in full.
            readBinary: entry => entry.read({ format: storage.formats?.binary })
        });
        const transaction = await this.transactionRunner({
            adapter,
            finalName: target.finalName,
            displayName: target.displayName,
            outputKind: OutputKind.AUTO_SAVE_PSD_COPY,
            transactionId: this.transactionId(),
            isCancellationRequested: () => this.cancelled(cancellationController),
            onDiagnostic: event => Logger.info(`ALB045_SAVE_COPY_${event}`),
            writeStaging: async staging => this.documentManager.save(document, staging),
            verify: (fileAdapter, entry) => verifyOutputEntry(
                fileAdapter, entry, { format: OutputVerificationFormat.PSD }
            )
        });
        const saved = transaction.commitState === "COMMITTED";
        const cancelled = transaction.status === OutputTransactionStatus.CANCELLED;
        return this.transactionResult(
            resultData,
            saved ? AutoSaveStatus.SAVED : (cancelled ? AutoSaveStatus.SKIPPED : AutoSaveStatus.FAILED),
            saved ? target.displayName : "",
            transaction
        );
    }

    transactionResult(data, status, outputPath, outputTransaction) {
        return new AutoSaveResult({
            ...data,
            status,
            outputPath,
            savedAt: status === AutoSaveStatus.SAVED ? new Date().toISOString() : null,
            warnings: status === AutoSaveStatus.SKIPPED ? ["Auto Save was cancelled safely."] : [],
            error: status === AutoSaveStatus.FAILED ? "Auto Save failed." : null,
            outputTransaction
        });
    }

    cancelled(controller) {
        return controller?.isCancellationRequested?.() === true;
    }

}
