import {
    isBlockingTemplateRegistryValidationState,
    normalizeTemplateRegistryValidationReason
} from "./TemplateRegistryValidationState";

export const TemplateRegistryRecoveryCompatibility = Object.freeze({
    COMPATIBLE: "COMPATIBLE",
    STALE_REGISTRY: "STALE_REGISTRY",
    BLOCKED_TEMPLATE_REGISTRY: "BLOCKED_TEMPLATE_REGISTRY"
});

/** Pure compatibility classification; it never mutates registry or recovery. */
export default class TemplateRegistryRecoveryCompatibilityService {

    evaluate({ descriptors = [], recoverySnapshot = null } = {}) {
        const entries = Array.isArray(descriptors) ? descriptors : [];
        const blockingReasonCodes = this.blockingReasonCodes(entries);

        if (blockingReasonCodes.length) {
            return Object.freeze({
                recoveryCompatibility:
                    TemplateRegistryRecoveryCompatibility.BLOCKED_TEMPLATE_REGISTRY,
                blockingReasonCodes
            });
        }

        if (recoverySnapshot && !this.sameIdentityAndOrder(entries, recoverySnapshot)) {
            return Object.freeze({
                recoveryCompatibility:
                    TemplateRegistryRecoveryCompatibility.STALE_REGISTRY,
                blockingReasonCodes
            });
        }

        return Object.freeze({
            recoveryCompatibility: TemplateRegistryRecoveryCompatibility.COMPATIBLE,
            blockingReasonCodes
        });
    }

    blockingReasonCodes(entries) {
        const reasons = [];
        entries.forEach(entry => {
            if (!isBlockingTemplateRegistryValidationState(entry?.validationState)) return;
            const reason = normalizeTemplateRegistryValidationReason(
                entry?.validationReason,
                entry?.validationState
            );
            if (!reasons.includes(reason)) reasons.push(reason);
        });
        return Object.freeze(reasons);
    }

    sameIdentityAndOrder(entries, recoverySnapshot) {
        const snapshotEntries = recoverySnapshot?.registrySnapshot;
        if (Array.isArray(snapshotEntries) && snapshotEntries.length) {
            if (snapshotEntries.length !== entries.length) return false;
            return entries.every((entry, index) => {
                const previous = snapshotEntries[index];
                return previous?.id === entry?.id &&
                    previous?.fileReference === entry?.fileReference &&
                    previous?.registrationOrder === entry?.registrationOrder;
            });
        }

        return recoverySnapshot?.registryVersion === this.registryVersion(entries);
    }

    registryVersion(entries) {
        return entries.map(entry =>
            `${entry?.id || ""}:${entry?.fileReference || ""}`
        ).join("|");
    }
}
