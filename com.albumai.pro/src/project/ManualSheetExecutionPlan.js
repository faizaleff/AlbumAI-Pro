import ExecutionPlan from "../placement/ExecutionPlan";
import { inspectManualSheetDesign } from "./ManualSheetDesign";
import { photoDecisionKey } from "../services/PhotoBrowserModel";

/** Resolves canonical ManualSheetDesign data into detached replacement steps. */
export default class ManualSheetExecutionPlan {

    build({ project, request, template, photos = [] } = {}) {
        const projectId = project?.metadata?.id ?? project?.metadata?.name;
        const design = inspectManualSheetDesign(request?.sheet?.design);
        if (!projectId || !request?.projectId || request.projectId !== projectId) {
            throw new Error("Manual Sheet plan does not match the active project.");
        }
        if (!design.valid || !design.design.assignments.length) {
            throw new Error("Manual Sheet has no assigned photos to render.");
        }
        if (!template || template.projectTemplateId !== request.sheet.templateId ||
            template.projectTemplateId !== request.template?.id ||
            template.document?.id == null) {
            throw new Error("Manual Sheet plan does not match the active template.");
        }

        const slots = new Map((Array.isArray(template.smartObjects)
            ? template.smartObjects
            : []).filter(slot => Number.isSafeInteger(slot?.layerId) && slot.layerId > 0)
            .map(slot => [slot.layerId, slot]));
        const photoByKey = new Map((Array.isArray(photos) ? photos : [])
            .map(photo => [photoDecisionKey(photo), photo])
            .filter(([photoKey, photo]) => photoKey && photo?.id != null));

        const steps = design.design.assignments
            .slice()
            .sort((left, right) => left.slotLayerId - right.slotLayerId)
            .map((assignment, index) => {
                const slot = slots.get(assignment.slotLayerId);
                const photo = photoByKey.get(assignment.photoKey);
                if (!slot) {
                    throw new Error("Manual Sheet design references a missing Smart Object slot.");
                }
                if (!photo?.file) {
                    throw new Error("Manual Sheet design references an unavailable photo.");
                }
                const photoFileReference = this.photoFileReference(photo);
                if (!photoFileReference) {
                    throw new Error("Manual Sheet design references an unavailable photo.");
                }
                return Object.freeze({
                    order: index + 1,
                    documentId: template.document.id,
                    slotLayerId: assignment.slotLayerId,
                    slotName: slot.layerName || "",
                    photoId: photo.id,
                    photoName: photo.name || "",
                    photoFileReference,
                    photoKey: assignment.photoKey,
                    cropFocus: assignment.cropFocus,
                    fitMode: "fill",
                    reasons: Object.freeze(["MANUAL_SHEET_DESIGN"])
                });
            });

        return new ExecutionPlan({
            id: this.id(request, template),
            projectId,
            templateId: template.id,
            templateDocumentId: template.document.id,
            steps,
            warnings: [],
            statistics: {
                readySteps: steps.length,
                warningCount: 0,
                reusedPhotos: steps.length - new Set(steps.map(step => step.photoId)).size,
                mode: "MANUAL_SHEET_DESIGN"
            },
            createdAt: new Date().toISOString()
        });
    }

    photoFileReference(photo) {
        return photo?.file?.nativePath || photo?.file?.name || null;
    }

    id(request, template) {
        return [
            "manual-sheet-plan",
            request.sheet.id,
            request.sheet.templateId,
            template.document.id,
            request.sheet.design.assignments.map(item =>
                `${item.slotLayerId}:${item.photoKey}:${item.cropFocus.x}:${item.cropFocus.y}`
            ).join("|")
        ].join(":");
    }
}
