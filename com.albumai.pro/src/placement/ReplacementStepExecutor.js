import DocumentManager from "../core/document/DocumentManager";
import LayerManager from "../core/layers/LayerManager";
import SmartObjectService from "../core/album/SmartObjectService";
import LayerBoundsService from "../core/album/LayerBoundsService";
import LayerTransformService from "../core/album/LayerTransformService";
import ExecuteModal from "../core/photoshop/ExecuteModal";
import Logger from "../core/photoshop/Logger";
import ReplacementResult from "./ReplacementResult";

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
            Logger.info("Smart Object replacement started.");
            const { document, layer, photo } = this.validate(step, photos);
            const originalBounds = this.positiveBounds(layer);

            await ExecuteModal.run(async () => {

                await this.smartObjectService.replaceContentsWithFileEntry({
                    layer,
                    fileEntry: photo.file,
                    batchPlayOptions: { alreadyInModal: true },
                    sourcePhotoExists: photos.some(item => item?.id === photo.id)
                });
                await this.restorePlaceholderGeometry({
                    document,
                    slotLayerId: step.slotLayerId,
                    originalBounds,
                    fitMode: step.fitMode,
                    cropFocus: step.cropFocus
                });

            }, {
                commandName: "Execute Smart Object Replacement"
            });

            if (this.documentManager.activeId !== document.id) {
                throw new Error("Template document is not active.");
            }
            Logger.info("Smart Object replacement completed.");

            return this.result({
                requestId: step.requestId,
                status: "SUCCESS",
                completedSteps: [step.stepNumber],
                startedAt
            });

        }

        catch (error) {

            const message = this.userError(error);
            Logger.warn("Smart Object replacement failed.");

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

        const layer = this.layerManager.byId(step.slotLayerId);

        if (!layer) throw new Error("Target Smart Object was not found.");
        if (layer.kind !== "smartObject") {
            throw new Error("Target Smart Object was not found.");
        }

        const photo = (Array.isArray(photos) ? photos : []).find(item =>
            item?.id === step.photoId
        );

        if (!photo?.file) throw new Error("Source photo is unavailable.");
        if (this.photoFileReference(photo) !== step.photoFileReference) {
            throw new Error("Source photo is unavailable.");
        }

        return { document, layer, photo };

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

        fitMode,

        cropFocus

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

        const { offsetX, offsetY } = this.cropFocusOffset(
            originalBounds,
            transformedBounds,
            cropFocus
        );

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

    cropFocusOffset(originalBounds, transformedBounds, cropFocus = null) {

        const x = Number.isFinite(cropFocus?.x) ? cropFocus.x : 0.5;
        const y = Number.isFinite(cropFocus?.y) ? cropFocus.y : 0.5;
        const desiredLeft = originalBounds.centerX - transformedBounds.width * x;
        const desiredTop = originalBounds.centerY - transformedBounds.height * y;
        const left = Math.min(
            originalBounds.left,
            Math.max(originalBounds.right - transformedBounds.width, desiredLeft)
        );
        const top = Math.min(
            originalBounds.top,
            Math.max(originalBounds.bottom - transformedBounds.height, desiredTop)
        );

        return Object.freeze({
            offsetX: left - transformedBounds.left,
            offsetY: top - transformedBounds.top
        });

    }

    refreshSlotLayer(document, slotLayerId) {

        this.layerManager.scan(document);

        const layer = this.layerManager.byId(slotLayerId);

        if (!layer) {
            throw new Error("Target Smart Object was not found.");
        }

        return layer;

    }

    photoFileReference(photo) {

        return photo.file?.nativePath || photo.file?.name || null;

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

        return "Replacement failed.";

    }

}
