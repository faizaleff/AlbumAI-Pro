import DocumentManager from "../core/document/DocumentManager";
import Logger from "../core/photoshop/Logger";
import AutoSaveResult, { AutoSaveStatus } from "./AutoSaveResult";

export const AutoSaveMode = Object.freeze({
    SAVE_COPY: "SAVE_COPY",
    OVERWRITE_ORIGINAL: "OVERWRITE_ORIGINAL"
});

/** Saves only a verified, successfully processed parent PSD document. */
export default class TemplateAutoSaveService {

    constructor({ documentManager = new DocumentManager() } = {}) {

        this.documentManager = documentManager;

    }

    async save({
        project,
        template,
        descriptor,
        documentContext,
        executionSummary,
        enabled = false,
        mode = AutoSaveMode.SAVE_COPY
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
                await this.documentManager.save(document);

                return new AutoSaveResult({
                    ...resultData,
                    status: AutoSaveStatus.SAVED,
                    outputPath: resultData.sourcePath || document.title || "",
                    savedAt: new Date().toISOString()
                });
            }

            const destination = await this.copyDestination(project, template, document, descriptor);
            Logger.info(`SAVE TARGET: ${destination.name}`);

            await this.documentManager.save(document, destination);

            return new AutoSaveResult({
                ...resultData,
                status: AutoSaveStatus.SAVED,
                outputPath: destination.nativePath || destination.name,
                savedAt: new Date().toISOString()
            });

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

        return processed.createFile(`${baseName}.psd`, {
            overwrite: true
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

}
