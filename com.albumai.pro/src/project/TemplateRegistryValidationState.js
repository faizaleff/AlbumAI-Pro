export const TemplateRegistryValidationState = Object.freeze({
    READY: "READY",
    MISSING: "MISSING",
    AMBIGUOUS: "AMBIGUOUS",
    ACCESS_ERROR: "ACCESS_ERROR",
    UNKNOWN: "UNKNOWN"
});

export const TemplateRegistryValidationReason = Object.freeze({
    UNIQUE_MATCH: "UNIQUE_MATCH",
    NO_MATCH: "NO_MATCH",
    MULTIPLE_MATCHES: "MULTIPLE_MATCHES",
    STORAGE_INSPECTION_FAILED: "STORAGE_INSPECTION_FAILED",
    NOT_VALIDATED: "NOT_VALIDATED"
});

export const TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION = 1;

const states = new Set(Object.values(TemplateRegistryValidationState));
const reasons = new Set(Object.values(TemplateRegistryValidationReason));

export function normalizeTemplateRegistryValidationState(value) {
    return states.has(value)
        ? value
        : TemplateRegistryValidationState.UNKNOWN;
}

export function normalizeTemplateRegistryValidationReason(value, state) {
    if (reasons.has(value)) return value;

    switch (normalizeTemplateRegistryValidationState(state)) {
    case TemplateRegistryValidationState.READY:
        return TemplateRegistryValidationReason.UNIQUE_MATCH;
    case TemplateRegistryValidationState.MISSING:
        return TemplateRegistryValidationReason.NO_MATCH;
    case TemplateRegistryValidationState.AMBIGUOUS:
        return TemplateRegistryValidationReason.MULTIPLE_MATCHES;
    case TemplateRegistryValidationState.ACCESS_ERROR:
        return TemplateRegistryValidationReason.STORAGE_INSPECTION_FAILED;
    default:
        return TemplateRegistryValidationReason.NOT_VALIDATED;
    }
}

export function isBlockingTemplateRegistryValidationState(value) {
    return normalizeTemplateRegistryValidationState(value) !==
        TemplateRegistryValidationState.READY;
}

export function normalizeTemplateRegistryValidation(value = {}) {
    const state = normalizeTemplateRegistryValidationState(
        value?.state || value?.validationState
    );

    return Object.freeze({
        state,
        reasonCode: normalizeTemplateRegistryValidationReason(
            value?.reasonCode || value?.validationReasonCode,
            state
        )
    });
}
