import DocumentManager from "../core/document/DocumentManager";
import LayerManager from "../core/layers/LayerManager";
import SmartObjectService from "../core/album/SmartObjectService";
import LayerBoundsService from "../core/album/LayerBoundsService";
import LayerTransformService from "../core/album/LayerTransformService";
import ExecuteModal from "../core/photoshop/ExecuteModal";
import Logger from "../core/photoshop/Logger";
import ReplacementResult from "./ReplacementResult";
import { getPhotoFileEntry } from "../services/PhotoFileEntry";

export default class ReplacementStepExecutor {

    constructor({
        documentManager = new DocumentManager(),
        layerManager = new LayerManager(),
        smartObjectService = new SmartObjectService(),
        layerBoundsService = new LayerBoundsService(),
        layerTransformService = new LayerTransformService()
    } = {}) {

        this.documentManager = documentManager;
        this.layerManager = layerManager;
        this.smartObjectService = smartObjectService;
        this.layerBoundsService = layerBoundsService;
        this.layerTransformService = layerTransformService;

    }

    async execute(step, photos = []) {

        const startedAt = new Date().toISOString();

        try {

            await this.recoverParentDocument(step);
            const { document, layer, photo, fileEntry } = this.validate(step, photos);
            const photoName = photo?.name || step?.photoName || photo?.file?.name || "Photo";
            const layerName = layer?.name || step?.slotName || `Layer ${layer?.id}`;

            const originalBounds = (step.slotBounds && step.slotBounds.width > 0 && step.slotBounds.height > 0)
                ? step.slotBounds
                : this.positiveBounds(layer);

            await ExecuteModal.run(async () => {

                const replaced = await this.smartObjectService.replaceContentsWithFileEntry({
                    layer,
                    fileEntry,
                    batchPlayOptions: { alreadyInModal: true },
                    sourcePhotoExists: photos.some(item => item?.id === photo.id)
                });
                if (!replaced) {
                    throw new Error("Smart Object replacement operation failed in Photoshop.");
                }
                await this.restorePlaceholderGeometry({
                    document,
                    slotLayerId: step.slotLayerId,
                    originalBounds,
                    fitMode: step.fitMode
                });

            }, {
                commandName: "Execute Smart Object Replacement"
            });

            if (this.documentManager.activeId !== document.id) {
                throw new Error("Template document is not active.");
            }
            Logger.info(`[AlbumAI:placement] STEP_SUCCESS doc=${document.id} layer=${layer.id} (${layerName}) photo=${photoName}`);

            return this.result({
                requestId: step.requestId,
                status: "SUCCESS",
                completedSteps: [step.stepNumber],
                startedAt
            });

        }

        catch (error) {

            const message = this.userError(error);
            Logger.warn(`[AlbumAI:placement] STEP_FAILED doc=${step?.expectedDocumentId || step?.documentId} layer=${step?.slotLayerId} error=${message}`);

            return this.result({
                requestId: step?.requestId ?? null,
                status: "FAILED",
                failedSteps: [{
                    stepNumber: step?.stepNumber ?? null,
                    slotLayerId: step?.slotLayerId ?? null,
                    message
                }],
                errors: [message],
                startedAt
            });

        }

    }

    async recoverParentDocument(step) {

        if (step?.expectedDocumentId == null) {
            return;
        }

        const parentDocument = this.documentManager.byId(
            step.expectedDocumentId
        );

        if (!parentDocument) {
            throw new Error("Template document is not active.");
        }

        if (this.documentManager.activeId !== parentDocument.id) {
            await this.documentManager.activate(parentDocument);
        }

    }

    validate(step, photos) {

        if (!step) throw new Error("Replacement request is not ready.");
        if (step.expectedDocumentId == null) {
            throw new Error("Template document is not active.");
        }
        if (step.slotLayerId == null) {
            throw new Error("Target Smart Object was not found.");
        }
        if (step.photoId == null) {
            throw new Error("Source photo is unavailable.");
        }
        if (step.expectedLayerType !== "smartObject") {
            throw new Error("Target Smart Object was not found.");
        }

        const document = this.documentManager.active;

        if (!document) throw new Error("Template document is not active.");

        if (document.id !== step.expectedDocumentId) {
            throw new Error("Template document is not active.");
        }

        this.layerManager.scan(document);

        const slotId = step.slotLayerId;
        const layer = this.layerManager.byId(slotId) ||
            (Number.isInteger(Number(slotId)) ? this.layerManager.byId(Number(slotId)) : null) ||
            this.layerManager.byId(String(slotId));

        if (!layer) throw new Error(`Target Smart Object was not found for slot ${slotId}.`);
        if (layer.kind !== "smartObject") {
            throw new Error(`Target layer ${slotId} is not a Smart Object (${layer.kind}).`);
        }

        const photo = (Array.isArray(photos) ? photos : []).find(item =>
            item?.id === step.photoId || String(item?.id) === String(step.photoId)
        );

        const fileEntry = getPhotoFileEntry(photo) || photo?.file;
        if (!fileEntry) throw new Error("Source photo is unavailable.");
        if (this.photoFileReference(photo) !== step.photoFileReference) {
            throw new Error("Source photo is unavailable.");
        }

        return { document, layer, photo, fileEntry };

    }

    positiveBounds(layer) {

        const bounds = this.layerBoundsService.get(layer);

        if (bounds.width <= 0 || bounds.height <= 0) {
            throw new Error("Target Smart Object was not found.");
        }

        return bounds;

    }

    async restorePlaceholderGeometry({

        document,

        slotLayerId,

        originalBounds,

        fitMode

    }) {

        const replacementLayer = this.refreshSlotLayer(document, slotLayerId);
        const replacementBounds = this.positiveBounds(replacementLayer);
        const normalizedFitMode = fitMode || "fill";

        let scaleFactor = 1;

        if (normalizedFitMode === "fill") {
            scaleFactor = Math.max(
                originalBounds.width / replacementBounds.width,
                originalBounds.height / replacementBounds.height
            );
        }

        else if (normalizedFitMode === "fit") {
            scaleFactor = Math.min(
                originalBounds.width / replacementBounds.width,
                originalBounds.height / replacementBounds.height
            );
        }

        else if (normalizedFitMode !== "center") {
            throw new Error("Replacement failed.");
        }

        if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
            throw new Error("Replacement failed.");
        }

        let transformedLayer = replacementLayer;
        let transformedBounds = replacementBounds;

        if (normalizedFitMode !== "center" && scaleFactor !== 1) {
            await this.layerTransformService.transform({
                layer: replacementLayer,
                scaleX: scaleFactor * 100,
                scaleY: scaleFactor * 100,
                batchPlayOptions: {
                    commandName: "Scale Replaced Smart Object",
                    alreadyInModal: true
                }
            });

            transformedLayer = this.refreshSlotLayer(document, slotLayerId);
            transformedBounds = this.positiveBounds(transformedLayer);
        }

        const offsetX = originalBounds.centerX - transformedBounds.centerX;
        const offsetY = originalBounds.centerY - transformedBounds.centerY;

        if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
            throw new Error("Replacement failed.");
        }

        if (offsetX !== 0 || offsetY !== 0) {
            await this.layerTransformService.transform({
                layer: transformedLayer,
                offsetX,
                offsetY,
                batchPlayOptions: {
                    commandName: "Center Replaced Smart Object",
                    alreadyInModal: true
                }
            });
        }

        if (normalizedFitMode === "fill") {
            await this.smartObjectService.clipToBounds({
                document,
                layer: this.refreshSlotLayer(document, slotLayerId),
                bounds: originalBounds,
                batchPlayOptions: { alreadyInModal: true }
            });
        }

        this.positiveBounds(this.refreshSlotLayer(document, slotLayerId));

    }

    refreshSlotLayer(document, slotLayerId) {

        this.layerManager.scan(document);

        const layer = this.layerManager.byId(slotLayerId) ||
            (Number.isInteger(Number(slotLayerId)) ? this.layerManager.byId(Number(slotLayerId)) : null) ||
            this.layerManager.byId(String(slotLayerId));

        if (!layer) {
            throw new Error(`Target Smart Object was not found for slot ${slotLayerId}.`);
        }

        return layer;

    }

    photoFileReference(photo) {

        const entry = getPhotoFileEntry(photo);
        return entry?.nativePath || entry?.name || photo?.file?.nativePath || photo?.file?.name || photo?.name || null;

    }

    result(data) {

        return new ReplacementResult({
            ...data,
            finishedAt: new Date().toISOString(),
            warnings: []
        });

    }

    userError(error) {

        const message = error?.message || "";

        if (message.startsWith("Template document") ||
            message.includes("parent PSD") ||
            message.includes("active document")) {
            return "Template document is not active.";
        }

        if (message.startsWith("Target Smart Object") ||
            message.includes("target layer") ||
            message.includes("Smart Object layer")) {
            return "Target Smart Object was not found.";
        }

        if (message.startsWith("Source photo") ||
            message.includes("source photo") ||
            message.includes("session token")) {
            return "Source photo is unavailable.";
        }

        if (message.includes("did not update") ||
            message.includes("rejected smart object") ||
            message.includes("rejected placedLayerReplaceContents") ||
            message.includes("not replaced")) {
            return message;
        }

        return "Replacement failed.";

    }

}
