import DocumentManager from "../core/document/DocumentManager";
import Logger from "../core/photoshop/Logger";
import { AutoSaveStatus } from "./AutoSaveResult";
import ExportResult, { ExportStatus } from "./ExportResult";
import { storage } from "uxp";
import OutputTransactionFileAdapter from "../project/OutputTransactionFileAdapter";
import { runOutputPromotionTransaction } from "../project/OutputPromotionPolicy";
import { OutputKind } from "../project/OutputTransactionState";
import { OutputTransactionStatus } from "../project/OutputTransactionPolicy";
import { OutputVerificationFormat, verifyOutputEntry } from "../project/OutputVerification";

export const ExportFormat = Object.freeze({
    PSD: "PSD",
    JPEG: "JPEG"
});

/** Exports verified parent PSD documents only after a successful Auto Save. */
export default class TemplateExportService {

    constructor({
        documentManager = new DocumentManager(),
        fileAdapterFactory = options => new OutputTransactionFileAdapter(options),
        transactionRunner = runOutputPromotionTransaction,
        transactionId = () => typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `export-${Date.now()}-${Math.random()}`
    } = {}) {

        this.documentManager = documentManager;
        this.fileAdapterFactory = fileAdapterFactory;
        this.transactionRunner = transactionRunner;
        this.transactionId = transactionId;
        this.inFlight = new Map();

    }

    export(options = {}) {

        const documentId = options.documentContext?.documentId ??
            options.template?.document?.id ?? "unknown";
        const templateId = options.descriptor?.id ?? options.template?.id ??
            options.descriptor?.name ?? options.template?.name ?? "unknown";
        const outputName = options.outputBaseName ? String(options.outputBaseName) : "";
        const key = `${documentId}:${templateId}:${outputName}:${options.format || ExportFormat.JPEG}`;
        if (this.inFlight.has(key)) {
            return this.inFlight.get(key);
        }

        const pending = this.performExport(options).finally(() => {
            if (this.inFlight.get(key) === pending) {
                this.inFlight.delete(key);
            }
        });
        this.inFlight.set(key, pending);
        return pending;

    }

    async performExport({
        project,
        template,
        descriptor,
        documentContext,
        autoSaveResult,
        enabled = false,
        format = ExportFormat.JPEG,
        cancellationController = null,
        outputBaseName = null
    } = {}) {

        const resultData = {
            templateId: template?.id ?? null,
            documentId: template?.document?.id ?? null,
            format
        };

        if (!enabled) {
            return this.skipped(resultData, "Export is disabled.");
        }

        if (autoSaveResult && autoSaveResult.status === AutoSaveStatus.FAILED) {
            return this.skipped(resultData, "Export requires successful Auto Save.");
        }

        if (!Object.values(ExportFormat).includes(format)) {
            return this.skipped(resultData, "Export format is unavailable.");
        }

        const documentId = documentContext?.documentId ?? template?.document?.id;
        const document = this.documentManager.byId(documentId);

        if (!document) {
            return this.skipped(resultData, "Template document is not active.");
        }
        await this.documentManager.activate(document);
        Logger.info(`ACTIVE DOCUMENT BEFORE EXPORT: ${this.documentManager.activeId}/${document.title}`);

        if (this.isPsb(template, document)) {
            return this.skipped(resultData, "Export does not support Smart Object documents.");
        }

        try {

            return this.exportTransaction({ project, template, descriptor, document, format, resultData, cancellationController, outputBaseName });

        }

        catch (_) {

            Logger.warn("Template export failed.");

            return new ExportResult({
                ...resultData,
                status: ExportStatus.FAILED,
                error: "Template export failed."
            });

        }

    }

    async destination(project, template, document, format, descriptor = null, outputBaseName = null) {

        const output = project?.workspace?.output;

        if (!output?.isFolder) {
            throw new Error("Project output folder is unavailable.");
        }

        const entries = await output.getEntries();
        let exportFolder = entries.find(entry =>
            entry.isFolder && entry.name === "Export"
        );

        if (!exportFolder) {
            exportFolder = await output.createFolder("Export");
        }

        const extension = format === ExportFormat.PSD ? "psd" : "jpg";
        const baseName = outputBaseName
            ? String(outputBaseName).trim() || "template"
            : this.baseName(descriptor?.name || template?.name || document?.title || "template");

        return Object.freeze({
            folder: exportFolder,
            finalName: `${baseName}.${extension}`,
            displayName: `${baseName}.${extension}`
        });

    }

    isPsb(template, document) {

        return /\.psb$/i.test(template?.filePath || "") ||
            /\.psb$/i.test(template?.name || "") ||
            /\.psb$/i.test(document?.title || "");

    }

    baseName(name) {

        return String(name).replace(/\.[^.]+$/, "") || "template";

    }

    skipped(data, warning) {

        return new ExportResult({
            ...data,
            status: ExportStatus.SKIPPED,
            warnings: [warning]
        });

    }

    async exportTransaction({ project, template, descriptor, document, format, resultData, cancellationController, outputBaseName = null }) {
        const target = await this.destination(project, template, document, format, descriptor, outputBaseName);
        const outputKind = format === ExportFormat.PSD
            ? OutputKind.EXPORT_PSD
            : OutputKind.EXPORT_JPEG;
        const verificationFormat = format === ExportFormat.PSD
            ? OutputVerificationFormat.PSD
            : OutputVerificationFormat.JPEG;
        const adapter = this.fileAdapterFactory({
            folder: target.folder,
            // Locked capability characterization supports binary reads but not
            // bounded header reads; verification can read the full export.
            readBinary: entry => entry.read({ format: storage.formats?.binary })
        });
        const transaction = await this.transactionRunner({
            adapter,
            finalName: target.finalName,
            displayName: target.displayName,
            outputKind,
            transactionId: this.transactionId(),
            isCancellationRequested: () => this.cancelled(cancellationController),
            onDiagnostic: event => Logger.info(`ALB045_EXPORT_${event}`),
            writeStaging: staging => format === ExportFormat.PSD
                ? this.documentManager.save(document, staging)
                : this.documentManager.exportJPEG(document, staging),
            verify: (fileAdapter, entry) => verifyOutputEntry(
                fileAdapter, entry, { format: verificationFormat }
            )
        });
        const success = transaction.commitState === "COMMITTED";
        const cancelled = transaction.status === OutputTransactionStatus.CANCELLED;
        return new ExportResult({
            ...resultData,
            status: success ? ExportStatus.SUCCESS : (cancelled ? ExportStatus.SKIPPED : ExportStatus.FAILED),
            outputPath: success ? target.displayName : "",
            exportedAt: success ? new Date().toISOString() : null,
            warnings: cancelled ? ["Export was cancelled safely."] : [],
            error: success || cancelled ? null : "Template export failed.",
            outputTransaction: transaction
        });
    }

    cancelled(controller) {
        return controller?.isCancellationRequested?.() === true;
    }

}
