import DocumentManager from "../core/document/DocumentManager";
import TemplateLayerTreeReader from "./TemplateLayerTreeReader";

export default class TemplateDocumentReader {

    constructor({
        projectEngine,
        documentManager = new DocumentManager(),
        layerTreeReader = new TemplateLayerTreeReader()
    } = {}) {

        if (!projectEngine) {
            throw new Error("ProjectEngine is required.");
        }

        this.projectEngine = projectEngine;
        this.documentManager = documentManager;
        this.layerTreeReader = layerTreeReader;
        this.ownedDocument = null;

    }

    async listTemplates() {

        const folder = this.getTemplatesFolder();
        const entries = await folder.getEntries();

        return entries.filter(entry =>
            entry.isFile && /\.psd$/i.test(entry.name)
        );

    }

    async read(templateFile) {

        const file = await this.requireProjectTemplate(
            templateFile
        );
        let document = null;

        try {
            document = await this.openDocument(file);
            await this.documentManager.activate(document);

            const layerTree = this.layerTreeReader.read(document);

            return {
                documentId: document.id,
                name: document.title || file.name,
                filePath: file.nativePath || document.path || file.name,
                width: this.number(document.width),
                height: this.number(document.height),
                resolution: this.number(document.resolution),
                colorMode: document.mode || null,
                bitDepth: document.bitsPerChannel || null,
                layerCount: document.layers?.length || 0,
                layerTree,
                smartObjects: this.layerTreeReader.smartObjects(),
                textLayers: this.layerTreeReader.textLayers()
            };
        }

        catch (error) {
            if (document && this.ownedDocument?.id === document.id) {
                try {
                    await this.close();
                } catch (cleanupError) {
                    const failure = new Error(
                        "The PSD could not be read and its Photoshop document could not be closed safely. Close the document manually before retrying."
                    );
                    failure.code = "TEMPLATE_READ_CLEANUP_FAILED";
                    failure.cause = error;
                    failure.cleanupError = cleanupError;
                    throw failure;
                }
            }
            throw error;
        }

    }

    async resolveRegisteredTemplate(descriptor) {

        const templates = await this.listTemplates();
        const file = templates.find(entry =>
            entry.nativePath === descriptor?.fileReference ||
            entry.name === descriptor?.fileName
        );

        if (!file) {
            throw new Error(`Registered PSD is missing: ${descriptor?.name || "template"}.`);
        }

        return this.read(file);

    }

    getTemplatesFolder() {

        const project = this.projectEngine.getProject();
        const folder = project?.workspace?.templates;

        if (!folder) {
            throw new Error(
                "Open a project before reading PSD templates."
            );
        }

        return folder;

    }

    async close() {

        this.releaseClosedOwnedDocument();

        const document = this.ownedDocument;

        if (!document) {
            return false;
        }

        try {

            await this.documentManager.close(document, {
                save: false
            });

            if (this.ownedDocument?.id === document.id) {
                this.ownedDocument = null;
            }

            return true;

        }

        finally {

            this.layerTreeReader.clear();

        }

    }

    async openDocument(file) {

        this.releaseClosedOwnedDocument();

        const existing = this.findOpenDocument(file);

        if (existing) {
            try {
                await this.documentManager.close(existing, { save: false });
            } catch {
                // Best effort close
            }
        }

        // The reader owns only one temporary PSD at a time. Releasing the
        // previous one keeps project batches from retaining documents between
        // queue items.
        if (this.ownedDocument) {
            await this.close();
        }

        const document = await this.documentManager.open(file);

        this.ownedDocument = document;

        return document;

    }

    findOpenDocument(file) {

        const documents = this.documentManager.documents;

        return documents.find(document => {

            if (
                file.nativePath &&
                document.path &&
                file.nativePath === document.path
            ) {
                return true;
            }

            return (
                this.ownedDocument?.id === document.id &&
                document.title === file.name
            );

        }) || null;

    }

    releaseClosedOwnedDocument() {

        if (!this.ownedDocument) {
            return;
        }

        const exists = this.documentManager.documents.some(
            document => document.id === this.ownedDocument.id
        );

        if (!exists) {
            this.ownedDocument = null;
            this.layerTreeReader.clear();
        }

    }

    async requireProjectTemplate(templateFile) {

        if (!templateFile || !templateFile.isFile) {
            throw new Error("Select a PSD template file.");
        }

        const templates = await this.listTemplates();
        const template = templates.find(entry =>
            entry.nativePath === templateFile.nativePath ||
            entry.name === templateFile.name
        );

        if (!template) {
            throw new Error(
                "PSD template must be in the active Project/Templates folder."
            );
        }

        return template;

    }

    number(value) {

        if (typeof value === "number") {
            return value;
        }

        if (typeof value?.value === "number") {
            return value.value;
        }

        const number = Number(value);

        return Number.isFinite(number) ? number : null;

    }

}
