export default class ReplacementStep {

    constructor(data = {}) {

        ReplacementStep.validate(data);

        return ReplacementStep.freeze({
            stepNumber: data.stepNumber,
            slotLayerId: data.slotLayerId,
            slotName: data.slotName || "",
            photoId: data.photoId,
            photoName: data.photoName || "",
            photoFileReference: data.photoFileReference,
            fitMode: data.fitMode || "fill",
            expectedLayerType: data.expectedLayerType,
            expectedDocumentId: data.expectedDocumentId
        });

    }

    static validate(data) {

        if (!Number.isInteger(data.stepNumber) || data.stepNumber < 1) {
            throw new Error("Replacement step requires a positive step number.");
        }

        if (data.slotLayerId == null) {
            throw new Error("Replacement step requires a slotLayerId.");
        }

        if (data.photoId == null) {
            throw new Error("Replacement step requires a photoId.");
        }

        if (typeof data.photoFileReference !== "string" || !data.photoFileReference) {
            throw new Error("Replacement step requires a serializable photo file reference.");
        }

        if (data.expectedLayerType !== "smartObject") {
            throw new Error("Replacement steps must target smartObject layers.");
        }

        if (data.expectedDocumentId == null) {
            throw new Error("Replacement step requires an expected document id.");
        }

    }

    static freeze(value) {

        return Object.freeze(value);

    }

}
