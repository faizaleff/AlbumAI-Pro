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
            Logger.info("Replacement trace: ReplacementStepExecutor before validate");
            const { document, layer, photo } = this.validate(step, photos);
            Logger.info("Replacement trace: ReplacementStepExecutor after validate");
            const originalBounds = this.positiveBounds(layer);

            await ExecuteModal.run(async () => {

                Logger.info("Replacement trace: before SmartObjectService.replace");
                await this.smartObjectService.replaceContentsWithFileEntry({
                    layer,
                    fileEntry: photo.file,
                    batchPlayOptions: { alreadyInModal: true },
                    sourcePhotoExists: photos.some(item => item?.id === photo.id)
                });
                Logger.info("Replacement trace: after SmartObjectService.replace");

                await this.restorePlaceholderGeometry({
                    document,
                    slotLayerId: step.slotLayerId,
                    originalBounds,
                    fitMode: step.fitMode
                });

            }, {
                commandName: "Execute Smart Object Replacement"
            });

            Logger.info("Replacement trace: before parent document verification");
            if (this.documentManager.activeId !== document.id) {
                throw new Error("Photoshop did not return to the parent PSD.");
            }
            Logger.info("Replacement trace: after parent document verification");

            return this.result({
                requestId: step.requestId,
                status: "SUCCESS",
                completedSteps: [step.stepNumber],
                startedAt
            });

        }

        catch (error) {

            return this.result({
                requestId: step?.requestId ?? null,
                status: "FAILED",
                failedSteps: [{
                    stepNumber: step?.stepNumber ?? null,
                    slotLayerId: step?.slotLayerId ?? null,
                    message: error.message
                }],
                errors: [error.message],
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
            throw new Error("Expected parent PSD is not open.");
        }

        if (this.documentManager.activeId !== parentDocument.id) {
            await this.documentManager.activate(parentDocument);
        }

    }

    validate(step, photos) {

        if (!step) throw new Error("Replacement step is required.");
        if (step.expectedDocumentId == null) {
            throw new Error("Replacement step is missing its expected document id.");
        }
        if (step.slotLayerId == null) {
            throw new Error("Replacement step is missing its target layer id.");
        }
        if (step.photoId == null) {
            throw new Error("Replacement step is missing its source photo id.");
        }
        if (step.expectedLayerType !== "smartObject") {
            throw new Error("Replacement step must target a Smart Object.");
        }

        Logger.info("Replacement trace: before DocumentManager.active");
        const document = this.documentManager.active;
        Logger.info("Replacement trace: after DocumentManager.active");

        if (!document) throw new Error("An active Photoshop document is required.");

        Logger.info(
            `Replacement trace: document-match comparison ${JSON.stringify({
                replacementStep: {
                    documentId: step.documentId ?? step.expectedDocumentId ?? null,
                    documentName: step.documentName ?? null,
                    documentPath: step.documentPath ?? null,
                    expectedDocumentId: step.expectedDocumentId ?? null
                },
                activeDocument: {
                    id: document.id ?? null,
                    title: document.title ?? null,
                    path: document.path ?? document.nativePath ?? null
                },
                comparison: `activeDocument.id (${document.id}) !== replacementStep.expectedDocumentId (${step.expectedDocumentId})`,
                result: document.id !== step.expectedDocumentId
            })}`
        );
        if (document.id !== step.expectedDocumentId) {
            throw new Error("Active document does not match the replacement step.");
        }

        Logger.info("Replacement trace: before LayerManager.scan");
        this.layerManager.scan(document);
        Logger.info("Replacement trace: after LayerManager.scan");

        const layer = this.layerManager.byId(step.slotLayerId);

        if (!layer) throw new Error("Replacement target layer does not exist.");
        if (layer.kind !== "smartObject") {
            throw new Error("Replacement target layer is not a Smart Object.");
        }

        const photo = (Array.isArray(photos) ? photos : []).find(item =>
            item?.id === step.photoId
        );

        if (!photo?.file) throw new Error("Replacement source photo does not exist.");
        if (this.photoFileReference(photo) !== step.photoFileReference) {
            throw new Error("Replacement source photo reference does not match the step.");
        }

        return { document, layer, photo };

    }

    positiveBounds(layer) {

        const bounds = this.layerBoundsService.get(layer);

        if (bounds.width <= 0 || bounds.height <= 0) {
            throw new Error(`Layer bounds must be greater than zero: ${layer.name || layer.id}`);
        }

        return bounds;

    }

    async restorePlaceholderGeometry({

        document,

        slotLayerId,

        originalBounds,

        fitMode

    }) {

        Logger.info(
            `Replacement geometry: original bounds ${JSON.stringify(originalBounds)}`
        );

        const replacementLayer = this.refreshSlotLayer(document, slotLayerId);
        const replacementBounds = this.positiveBounds(replacementLayer);
        const normalizedFitMode = fitMode || "fill";

        Logger.info(
            `Replacement geometry: after replacement ${JSON.stringify({
                bounds: replacementBounds,
                fitMode: normalizedFitMode
            })}`
        );

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
            throw new Error(`Unsupported replacement fit mode: ${normalizedFitMode}`);
        }

        if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
            throw new Error("Replacement geometry scale factor is invalid.");
        }

        Logger.info(
            `Replacement geometry: scale ${JSON.stringify({
                fitMode: normalizedFitMode,
                scaleFactor
            })}`
        );

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
            throw new Error("Replacement geometry offset is invalid.");
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

        const finalLayer = this.refreshSlotLayer(document, slotLayerId);
        const finalBounds = this.positiveBounds(finalLayer);

        Logger.info(
            `Replacement geometry: final bounds ${JSON.stringify(finalBounds)}`
        );

    }

    refreshSlotLayer(document, slotLayerId) {

        this.layerManager.scan(document);

        const layer = this.layerManager.byId(slotLayerId);

        if (!layer) {
            throw new Error("Replacement target layer no longer exists after replacement.");
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

}
