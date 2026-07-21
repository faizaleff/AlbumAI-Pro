import ReplacementStep from "./ReplacementStep";

export default class ReplacementRequest {

    constructor({ executionPlan } = {}) {

        if (!executionPlan) {
            throw new Error("An execution plan is required.");
        }

        const steps = this.steps(executionPlan);
        const createdAt = new Date().toISOString();

        return ReplacementRequest.freeze({
            id: this.id(executionPlan, createdAt),
            projectId: executionPlan.projectId,
            templateId: executionPlan.templateId,
            documentId: executionPlan.templateDocumentId,
            executionPlanId: executionPlan.id,
            steps,
            createdAt
        });

    }

    steps(executionPlan) {

        const stepNumbers = new Set();
        const slotLayerIds = new Set();
        const sourceSteps = Array.isArray(executionPlan.steps)
            ? executionPlan.steps
            : [];

        return sourceSteps.map(step => {

            const replacementStep = new ReplacementStep({
                stepNumber: step.order,
                slotLayerId: step.slotLayerId,
                slotName: step.slotName,
                photoId: step.photoId,
                photoName: step.photoName,
                photoFileReference: step.photoFileReference,
                fitMode: step.fitMode,
                expectedLayerType: "smartObject",
                expectedDocumentId: step.documentId
            });

            if (stepNumbers.has(replacementStep.stepNumber)) {
                throw new Error("Replacement request contains duplicate step numbers.");
            }

            if (slotLayerIds.has(replacementStep.slotLayerId)) {
                throw new Error("Replacement request contains duplicate slotLayerId values.");
            }

            stepNumbers.add(replacementStep.stepNumber);
            slotLayerIds.add(replacementStep.slotLayerId);

            return replacementStep;

        });

    }

    id(executionPlan, createdAt) {

        return ["replacement-request", executionPlan.id, createdAt].join(":");

    }

    static freeze(value) {

        Object.values(value).forEach(item => {
            if (item && typeof item === "object" && !Object.isFrozen(item)) {
                Object.freeze(item);
            }
        });

        return Object.freeze(value);

    }

}
