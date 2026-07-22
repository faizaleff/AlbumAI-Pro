import DocumentManager from "../core/document/DocumentManager";
import LayerManager from "../core/layers/LayerManager";
import SmartObjectService from "../core/album/SmartObjectService";
import BatchPlay from "../core/photoshop/BatchPlay";
import ReplacementResult from "./ReplacementResult";

export default class ReplacementStepExecutor {

    constructor({
        documentManager = new DocumentManager(),
        layerManager = new LayerManager(),
        smartObjectService = new SmartObjectService(),
        batchPlay = BatchPlay
    } = {}) {

        this.documentManager = documentManager;
        this.layerManager = layerManager;
        this.smartObjectService = smartObjectService;
        this.batchPlay = batchPlay;

    }

    async execute(step, photos = []) {

        const startedAt = new Date().toISOString();
        let smartObjectOpened = false;

        try {

            const { document, layer, photo } = this.validate(step, photos);

            await this.openSmartObject(layer.id);
            smartObjectOpened = true;

            await this.smartObjectService.replace({
                layer,
                image: photo.file
            });
            await this.saveSmartObject();
            await this.closeSmartObject();
            smartObjectOpened = false;

            if (this.documentManager.activeId !== document.id) {
                throw new Error("Photoshop did not return to the parent PSD.");
            }

            return this.result({
                requestId: step.requestId,
                status: "SUCCESS",
                completedSteps: [step.stepNumber],
                startedAt
            });

        }

        catch (error) {

            if (smartObjectOpened) {
                await this.discardSmartObjectChanges();
            }

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

        const document = this.documentManager.active;

        if (!document) throw new Error("An active Photoshop document is required.");
        if (document.id !== step.expectedDocumentId) {
            throw new Error("Active document does not match the replacement step.");
        }

        this.layerManager.scan(document);

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

    async openSmartObject(layerId) {

        await this.batchPlay.execute([
            {
                _obj: "select",
                _target: [{ _ref: "layer", _id: layerId }],
                makeVisible: false
            },
            {
                _obj: "placedLayerEditContents"
            }
        ], {
            commandName: "Open Smart Object"
        });

    }

    async saveSmartObject() {

        await this.batchPlay.command({
            _obj: "save"
        }, {
            commandName: "Save Smart Object"
        });

    }

    async closeSmartObject() {

        await this.batchPlay.command({
            _obj: "close",
            saving: "yes"
        }, {
            commandName: "Return To Parent PSD"
        });

    }

    async discardSmartObjectChanges() {

        try {

            await this.batchPlay.command({
                _obj: "close",
                saving: "no"
            }, {
                commandName: "Discard Smart Object Changes"
            });

        }

        catch (_) {
            // The original replacement error is the actionable failure.
        }

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
