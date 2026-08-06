const STATUS_LABELS = Object.freeze({
    READY: "Ready",
    MISSING: "Missing",
    AMBIGUOUS: "Ambiguous",
    ACCESS_ERROR: "Access error",
    UNKNOWN: "Needs validation"
});

const RECOVERY_LABELS = Object.freeze({
    COMPATIBLE: "Compatible",
    BLOCKED_TEMPLATE_REGISTRY: "Blocked by template registry",
    STALE_REGISTRY: "Registry changed since recovery snapshot"
});

export function templateValidationLabel(state) {
    return STATUS_LABELS[state] || STATUS_LABELS.UNKNOWN;
}

export function templateRegistryUiSummary(entries = [], preflight = null) {
    const ready = Number.isInteger(preflight?.ready)
        ? preflight.ready
        : entries.filter(entry => entry?.validationState === "READY").length;
    const total = Number.isInteger(preflight?.total)
        ? preflight.total
        : entries.length;
    const blocking = Number.isInteger(preflight?.blocking)
        ? preflight.blocking
        : Math.max(0, total - ready);
    return Object.freeze({ total, ready, blocking });
}

export function templateRegistryIsBlocked(entries = [], preflight = null) {
    const summary = templateRegistryUiSummary(entries, preflight);
    return summary.blocking > 0 || entries.some(entry =>
        entry?.validationState !== "READY"
    );
}

export function canRevalidateTemplates({
    hasProject,
    isExecuting,
    registryMutating,
    revalidateBusy,
    workspaceAvailable = true
}) {
    return Boolean(hasProject && workspaceAvailable) &&
        !isExecuting && !registryMutating && !revalidateBusy;
}

export function canProcessProject({ hasProject, isExecuting, entries, preflight }) {
    return Boolean(hasProject) && !isExecuting &&
        !templateRegistryIsBlocked(entries, preflight);
}

export function revalidationFeedback(result) {
    if (!result) return "Template validation did not return a result.";
    if (String(result.reason || "").endsWith("_PERSISTENCE_FAILED")) {
        return "Template validation changed, but the project could not be saved.";
    }
    return result.persisted
        ? "Templates revalidated and changes saved."
        : "Templates revalidated; no changes found.";
}

export function executionGateFeedback(result) {
    if (result?.status === "TEMPLATE_REGISTRY_PREFLIGHT_PERSISTENCE_FAILED") {
        return "Template validation could not be saved. Processing did not start.";
    }
    if (result?.status === "TEMPLATE_REGISTRY_BLOCKED") {
        return "Template registry needs attention before processing.";
    }
    return "";
}

export function recoveryCompatibilityLabel(value) {
    return RECOVERY_LABELS[value] || "";
}

export function shouldResetTemplatePreflightUi({ hasProject, projectId, previousProjectId }) {
    return !hasProject || projectId !== previousProjectId;
}

export function emptyTemplateRegistryUiSession() {
    return Object.freeze({
        registeredTemplates: Object.freeze([]),
        selectedRegisteredId: "",
        preflight: null,
        message: "",
        busy: false,
        workspaceAvailable: false
    });
}

export function isCurrentTemplateRegistryRequest({
    mounted,
    requestId,
    currentRequestId,
    projectId,
    currentProjectId
}) {
    return mounted === true && requestId === currentRequestId &&
        projectId === currentProjectId;
}
