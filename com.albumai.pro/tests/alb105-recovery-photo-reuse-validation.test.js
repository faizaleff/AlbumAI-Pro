import assert from "assert";

import { AppController } from "../src/app/AppController";
import BatchRecoverySnapshot from "../src/project/BatchRecoverySnapshot";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

function completedSnapshot(overrides = {}) {
    const templateId = "template-01";
    const photoId = "/Project/Photos/reused.jpg";
    return {
        schemaVersion: 3,
        recoveryVersion: 1,
        projectId: "project-1",
        batchId: "batch-1",
        registryVersion: `${templateId}:01.psd`,
        registrySnapshot: [{
            id: templateId,
            name: "01.psd",
            fileReference: "01.psd",
            registrationOrder: 0
        }],
        queueOrder: [templateId],
        lifecycle: "COMPLETED",
        completedTemplateIds: [templateId],
        successfulTemplateIds: [templateId],
        failedTemplateIds: [],
        pendingTemplateIds: [],
        templateOutcomes: [{ templateId, status: "COMPLETED" }],
        warnings: [],
        selectedPhotoOrder: [photoId, photoId],
        photoCursor: 2,
        consumedPhotoIds: [photoId, photoId],
        remainingPhotoIds: [],
        ...overrides
    };
}

const reusedPhotoSnapshot = completedSnapshot();
const validation = BatchRecoverySnapshot.validatePersisted(reusedPhotoSnapshot);
check(validation.valid, "A photo reused in two slots remains valid recovery data");
check(validation.status === "VALID", "Repeated ordered photo allocations do not become INVALID");
check(validation.reasons.length === 0, "Valid photo reuse produces no recovery diagnostics");

const controller = Object.create(AppController.prototype);
controller.project = { getProject: () => ({ metadata: { id: "project-1" } }) };
controller.projectTemplateRegistry = {
    getAll: () => [{ id: "template-01", fileReference: "01.psd" }]
};
controller.loadRecovery(reusedPhotoSnapshot);
const state = controller.getBatchRecoveryState();
check(state.classification === "COMPLETED", "A successful reused-photo snapshot reloads as COMPLETED");
check(state.available === false, "A completed snapshot does not expose a recovery action");
check(state.diagnostics.status === "VALID", "Reloaded completed recovery retains VALID diagnostics");

const duplicateQueue = BatchRecoverySnapshot.validatePersisted(completedSnapshot({
    queueOrder: ["template-01", "template-01"]
}));
check(duplicateQueue.status === "INVALID", "Duplicate template queue IDs remain invalid");
check(duplicateQueue.reasons.some(reason => reason.includes("queueOrder contains duplicate ids")), "Duplicate template queue diagnostics remain actionable");

const invalidPhotoId = BatchRecoverySnapshot.validatePersisted(completedSnapshot({
    selectedPhotoOrder: ["/Project/Photos/reused.jpg", ""]
}));
check(invalidPhotoId.status === "INVALID", "Repeated photos are allowed without accepting empty photo IDs");
check(invalidPhotoId.reasons.some(reason => reason.includes("selectedPhotoOrder contains an invalid id")), "Invalid photo ID diagnostics remain actionable");

console.log(`ALB-105 recovery photo reuse validation tests passed (${assertions} assertions).`);
