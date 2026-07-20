// src/core/document/DocumentManager.js

import { app, core } from "photoshop";
import { storage } from "uxp";

import Logger from "../photoshop/Logger";

/**
 * Thin, live view of Photoshop documents.  Document DOM objects are host
 * objects, so this class deliberately does not retain them as the source of
 * truth; each lookup is reconciled against app.documents.
 */
class DocumentManager {

    constructor() {
        this.activeDocumentId = null;
    }

    get documents() { return [...app.documents]; }
    get active() { return app.activeDocument ?? null; }
    get activeId() { return this.active?.id ?? null; }
    get count() { return app.documents.length; }

    sync() {
        this.activeDocumentId = this.activeId;
        return this.active;
    }

    byId(id) { return this.documents.find(doc => doc.id === id) || null; }
    byTitle(title) { return this.documents.find(doc => doc.title === title) || null; }

    remember() {
        this.activeDocumentId = this.activeId;
        Logger.debug(`Remembered document ${this.activeDocumentId}`);
    }

    remembered() { return this.activeDocumentId == null ? null : this.byId(this.activeDocumentId); }
    hasDocuments() { return this.count > 0; }
    exists(id) { return this.byId(id) !== null; }
    names() { return this.documents.map(doc => doc.title); }
    reset() { this.activeDocumentId = null; }

    /** Open a FileSystemEntry (or a UXP URL) as one modal host operation. */
    async open(file) {
        const entry = await this.resolveEntry(file);

        return core.executeAsModal(async () => {
            const document = await app.open(entry);
            this.activeDocumentId = document.id;
            return document;
        }, { commandName: "Open Album Template" });
    }

    /** Activate a currently-open document; stale document objects are rejected. */
    async activate(document) {
        const liveDocument = this.requireOpen(document);

        await core.executeAsModal(async () => {
            app.activeDocument = liveDocument;
        }, { commandName: "Activate Album Document" });

        this.activeDocumentId = liveDocument.id;
        return liveDocument;
    }

    /**
     * Save in place, or save a PSD copy to a supplied FileSystemEntry/UXP URL.
     * Photoshop's DOM exposes format-specific saveAs methods; using PSD here
     * avoids relying on the legacy ExtendScript saveAs signature.
     */
    async save(document = this.active, destination = null, options = {}) {
        const liveDocument = this.requireOpen(document);
        const entry = destination ? await this.resolveEntry(destination) : null;

        await core.executeAsModal(async () => {
            if (!entry) {
                await liveDocument.save();
                return;
            }

            if (typeof liveDocument.saveAs?.psd !== "function") {
                throw new Error("This Photoshop version cannot save PSD files through the UXP DOM.");
            }

            await liveDocument.saveAs.psd(entry, {
                embedColorProfile: true,
                ...options
            }, true);
        }, { commandName: "Save Album PSD" });

        return liveDocument;
    }

    /** Close without causing Photoshop's save prompt. */
    async close(document, options = {}) {
        if (!document) return;
        const { save = false } = typeof options === "boolean" ? { save: options } : options;
        const liveDocument = this.requireOpen(document);

        await core.executeAsModal(async () => {
            if (save && !liveDocument.saved) await liveDocument.save();
            await liveDocument.close({ save: false });
        }, { commandName: "Close Album Document" });

        if (this.activeDocumentId === liveDocument.id) this.activeDocumentId = this.activeId;
    }

    requireOpen(document) {
        if (!document?.id) throw new Error("A Photoshop document is required.");
        const liveDocument = this.byId(document.id);
        if (!liveDocument) throw new Error(`Document ${document.id} is no longer open.`);
        return liveDocument;
    }

    async resolveEntry(file) {
        if (!file) throw new Error("A FileSystemEntry is required.");
        if (typeof file !== "string") return file;
        if (typeof storage.localFileSystem.getEntryWithUrl !== "function") {
            throw new Error("File URLs are not supported by this UXP host.");
        }
        return storage.localFileSystem.getEntryWithUrl(file);
    }
}

export default DocumentManager;
