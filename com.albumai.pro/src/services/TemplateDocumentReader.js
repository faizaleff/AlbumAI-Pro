import { imaging, app, core, action } from "photoshop";
import { storage } from "uxp";
import RefreshService from "./RefreshService";
import DocumentManager from "../core/document/DocumentManager";
import TemplateLayerTreeReader from "./TemplateLayerTreeReader";
import { captureSlotShape } from "./SlotShapePreview";

// Coordinates refer to the pixels returned by Photoshop, including pyramid/trim offsets.
export function previewSlotRegions(steps, bounds, level = 0) {
    const scale = 2 ** level;
    if (!bounds || !Number.isFinite(scale) || scale <= 0) return [];
    const {left, top, right, bottom} = bounds;
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return [];
    return (steps || []).flatMap(step => {
        const b = step.slotBounds;
        if (step.slotLayerId == null || !b || ![b.left, b.top, b.right, b.bottom].every(Number.isFinite)) return [];
        const x = Math.max(0, (b.left / scale - left) / (right - left));
        const y = Math.max(0, (b.top / scale - top) / (bottom - top));
        const endX = Math.min(1, (b.right / scale - left) / (right - left));
        const endY = Math.min(1, (b.bottom / scale - top) / (bottom - top));
        return endX > x && endY > y ? [{id: step.slotLayerId, x, y, width: endX - x, height: endY - y}] : [];
    });
}

// Bounded session previews: never persist image data in project metadata.
export class PsdPreviewStore {
    constructor(api = imaging, modal = core.executeAsModal, actions = action) {
        this.api = api; this.modal = modal; this.actions = actions;
        this.entries = new Map();
        this.latestReady = new Map();
        this.templates = new Map();
        this.shapeUrls = new Set();
    }
    key(projectId, sheet, template, photos = []) {
        const ids = new Set((sheet?.slots || []).map(slot => String(slot.photoId)));
        return JSON.stringify([projectId, template?.fileReference || template?.fileName || template?.name,
            sheet ? [sheet.id, sheet.slots, sheet.typographyAssignments || [],
                photos.filter(photo => ids.has(String(photo.id))).map(photo => [photo.id, photo.modified, photo.fileSize])] : null]);
    }
    subject(key) {
        try {
            const [projectId, templateRef, sheet] = JSON.parse(key);
            return sheet ? JSON.stringify([projectId, templateRef, sheet[0]]) : null;
        } catch (_) { return null; }
    }
    get(key) { return this.entries.get(key) || this.templates.get(key); }
    set(key, value) {
        this.entries.delete(key); this.entries.set(key, value);
        while (this.entries.size > 12) this.entries.delete(this.entries.keys().next().value);
        const subject = this.subject(key);
        if (!subject && value?.status === "ready") {
            this.templates.delete(key); this.templates.set(key, value);
            while (this.templates.size > 32) this.templates.delete(this.templates.keys().next().value);
        }
        if (subject && value?.status === "ready") {
            this.latestReady.delete(subject); this.latestReady.set(subject, {key, value});
            while (this.latestReady.size > 64) this.latestReady.delete(this.latestReady.keys().next().value);
        }
        this.releaseUnusedShapes();
        RefreshService.refresh();
    }
    resolve(projectId, sheet, template, photos = []) {
        const key = this.key(projectId, sheet, template, photos);
        const exact = this.get(key);
        const subject = this.subject(key);
        const fallback = subject ? this.latestReady.get(subject)?.value : null;
        const image = exact?.status === "ready" ? exact : fallback || this.get(this.key(projectId,null,template));
        return {key, exact, image, dirty: !!sheet && image?.status === "ready" && exact?.status !== "ready"};
    }
    releaseUnusedShapes() {
        const used = new Set([...this.templates.values(), ...this.entries.values(), ...[...this.latestReady.values()].map(item => item.value)]
            .flatMap(value => (value?.regions || []).map(region => region.coverSrc).filter(Boolean)));
        for (const url of this.shapeUrls) if (!used.has(url)) { URL.revokeObjectURL(url); this.shapeUrls.delete(url); }
    }
    clear() { this.entries.clear(); this.latestReady.clear(); this.templates.clear(); this.releaseUnusedShapes(); }
    begin(key) { const job = {}; this.set(key, {status: "rendering", job}); return job; }
    fail(key, job) { if (this.get(key)?.job === job) this.set(key, {status: "error"}); }
    async capture(key, documentId, job = this.begin(key), cancelled = () => false, steps = []) {
        let pixels, canvasBounds, orientations = {}, covers = {};
        try {
            if (cancelled()) throw new Error("Preview interrupted");
            const data = await this.modal(async () => {
            const doc = [...(app?.documents || [])].find(doc => doc.id === documentId);
            if (this.actions?.batchPlay) for (const step of steps) {
                try {
                    const [descriptor] = await this.actions.batchPlay([{_obj: "get", _target: [
                        {_property: "smartObjectMore"}, {_ref: "layer", _id: step.slotLayerId},
                        {_ref: "document", _id: documentId}]}], {});
                    const t = descriptor?.smartObjectMore?.transform;
                    if (t?.length === 8 && t.every(Number.isFinite)) orientations[step.slotLayerId] = {
                        flipX: t[2] < t[0], flipY: t[7] < t[1],
                        supported: Math.abs(t[3] - t[1]) < 1 && Math.abs(t[6] - t[0]) < 1};
                } catch (_) { /* Composite stays available when geometry cannot be read. */ }
            }
            if (doc && this.api.getLayerMask && this.actions?.batchPlay) for (const step of steps) {
                try { covers[step.slotLayerId] = await captureSlotShape(this.api, this.actions, doc, step, cancelled); }
                catch (error) { console.warn("PSD_SLOT_SHAPE_PREVIEW_FAILED", step.slotLayerId, error?.message); }
            }
            canvasBounds = doc ? {left: 0, top: 0, right: Number(doc.width), bottom: Number(doc.height)} : null;
            pixels = await this.api.getPixels({documentID: documentId,
                ...(doc ? {sourceBounds: {left: 0, top: 0, right: Number(doc.width), bottom: Number(doc.height)}} : {}),
                targetSize: {width: 1400},
                colorSpace: "RGB", colorProfile: "sRGB IEC61966-2.1", componentSize: 8, applyAlpha: true});
            return this.api.encodeImageData({imageData: pixels.imageData, base64: true});
            }, {commandName: "Render preview"});
            if (cancelled()) throw new Error("Preview interrupted");
            if (this.get(key)?.job !== job) return;
            Object.values(covers).filter(Boolean).forEach(url => this.shapeUrls.add(url));
            this.set(key, {status: "ready", template: !this.subject(key), src: "data:image/jpeg;base64," + data,
                aspect: pixels.imageData.width / pixels.imageData.height,
                regions: previewSlotRegions(steps, pixels.sourceBounds || canvasBounds, pixels.sourceBounds ? (pixels.level || 0) : 0)
                    .map(region => ({...region, ...orientations[region.id], coverSrc: covers[region.id] || null}))});
        } catch (error) { console.warn("PSD_PREVIEW_FAILED", error?.message); this.fail(key, job); }
        finally {
            try { pixels?.imageData?.dispose(); } catch (_) {}
            for (const url of Object.values(covers)) if (url && !this.shapeUrls.has(url)) URL.revokeObjectURL(url);
        }
    }
}
export const PsdPreviews = new PsdPreviewStore();

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
            const project = this.projectEngine.getProject();
            await PsdPreviews.capture(PsdPreviews.key(project?.metadata?.id, null, {name: file.name}), document.id, undefined, undefined,
                this.layerTreeReader.smartObjects().map(slot => ({slotLayerId: slot.layerId, slotBounds: slot.bounds})));

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

    // Preview a disposable disk copy, never close or modify a working PSD.
    async previewRegisteredTemplate(descriptor, { capturePreview = true } = {}) {
        const file = (await this.listTemplates()).find(item =>
            item.nativePath === descriptor.fileReference || item.name === descriptor.fileName);
        if (!file) throw new Error("Registered PSD is missing.");
        const temp = await storage.localFileSystem.getTemporaryFolder();
        const folder = await temp.createFolder(`albumai-preview-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const copy = await file.copyTo(folder);
        const previous = this.documentManager.active;
        let document;
        try {
            document = await this.documentManager.open(copy);
            const tree = new TemplateLayerTreeReader();
            tree.read(document);
            const project = this.projectEngine.getProject();
            if (capturePreview) await PsdPreviews.capture(PsdPreviews.key(project?.metadata?.id, null, descriptor), document.id, undefined, undefined,
                tree.smartObjects().map(slot => ({slotLayerId: slot.layerId, slotBounds: slot.bounds})));
            return {smartObjects: tree.smartObjects(), textLayers: tree.textLayers()};
        } finally {
            if (document) await this.documentManager.close(document, {save: false});
            if (previous && this.documentManager.byId(previous.id)) await this.documentManager.activate(previous);
            await copy.delete();
            await folder.delete();
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
