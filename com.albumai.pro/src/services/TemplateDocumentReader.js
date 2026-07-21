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
        const document = await this.openDocument(file);

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

        this.ownedDocument = null;

        try {

            await this.documentManager.close(document, {
                save: false
            });

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
            return existing;
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
