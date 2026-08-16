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
            cropFocus: ReplacementStep.cropFocus(data.cropFocus),
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

    static cropFocus(value) {
        const x = Number(value?.x);
        const y = Number(value?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) ||
            x < 0 || x > 1 || y < 0 || y > 1) {
            return Object.freeze({ x: 0.5, y: 0.5 });
        }
        return Object.freeze({
            x: Math.round(x * 1000000) / 1000000,
            y: Math.round(y * 1000000) / 1000000
        });
    }

    static freeze(value) {

        return Object.freeze(value);

    }

}
