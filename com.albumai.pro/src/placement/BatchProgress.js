export const BatchProgressStatus = Object.freeze({
    IDLE: "IDLE",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED"
});

export default class BatchProgress {

    constructor(data = {}) {

        return BatchProgress.freeze({
            currentStep: data.currentStep || 0,
            totalSteps: data.totalSteps || 0,
            completedSteps: data.completedSteps || 0,
            successCount: data.successCount || 0,
            failedCount: data.failedCount || 0,
            currentPhotoId: data.currentPhotoId ?? null,
            currentPhotoName: data.currentPhotoName || "",
            currentSlotLayerId: data.currentSlotLayerId ?? null,
            currentSlotName: data.currentSlotName || "",
            currentTemplateId: data.currentTemplateId ?? null,
            currentTemplateName: data.currentTemplateName || "",
            percentComplete: data.percentComplete || 0,
            status: data.status || BatchProgressStatus.IDLE,
            updatedAt: data.updatedAt || new Date().toISOString()
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => BatchProgress.freeze(item));

        return Object.freeze(value);

    }

}
