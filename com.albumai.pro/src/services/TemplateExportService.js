import DocumentManager from "../core/document/DocumentManager";
import Logger from "../core/photoshop/Logger";
import { AutoSaveStatus } from "./AutoSaveResult";
import ExportResult, { ExportStatus } from "./ExportResult";

export const ExportFormat = Object.freeze({
    PSD: "PSD",
    JPEG: "JPEG"
});

/** Exports verified parent PSD documents only after a successful Auto Save. */
export default class TemplateExportService {

    constructor({ documentManager = new DocumentManager() } = {}) {

        this.documentManager = documentManager;

    }

    async export({
        project,
        template,
        descriptor,
        documentContext,
        autoSaveResult,
        enabled = false,
        format = ExportFormat.JPEG
    } = {}) {

        const resultData = {
            templateId: template?.id ?? null,
            documentId: template?.document?.id ?? null,
            format
        };

        if (!enabled) {
            return this.skipped(resultData, "Export is disabled.");
        }

        if (autoSaveResult?.status !== AutoSaveStatus.SAVED) {
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

            const destination = await this.destination(project, template, document, format, descriptor);
            Logger.info(`EXPORT TARGET: ${destination.name}`);

            if (format === ExportFormat.PSD) {
                await this.documentManager.save(document, destination);
            }
            else {
                await this.documentManager.exportJPEG(document, destination);
            }

            return new ExportResult({
                ...resultData,
                status: ExportStatus.SUCCESS,
                outputPath: destination.nativePath || destination.name,
                exportedAt: new Date().toISOString()
            });

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

    async destination(project, template, document, format, descriptor = null) {

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
        const baseName = this.baseName(descriptor?.name || template?.name || document?.title || "template");

        return exportFolder.createFile(`${baseName}.${extension}`, {
            overwrite: true
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

}
