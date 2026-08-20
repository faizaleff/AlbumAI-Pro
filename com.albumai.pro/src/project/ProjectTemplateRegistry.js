import {
    TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION,
    TemplateRegistryValidationReason,
    TemplateRegistryValidationState,
    isBlockingTemplateRegistryValidationState,
    normalizeTemplateRegistryValidationReason,
    normalizeTemplateRegistryValidationState
} from "./TemplateRegistryValidationState";

/**
 * Return a reordered copy without changing either the input array or its entries.
 * Invalid/no-op moves are deliberately rejected as `null` so callers cannot
 * accidentally replace a registry with a partial collection.
 */
export function reorderTemplates(templates, sourceIndex, targetIndex) {
    if (!Array.isArray(templates) ||
        !Number.isInteger(sourceIndex) ||
        !Number.isInteger(targetIndex) ||
        sourceIndex < 0 || targetIndex < 0 ||
        sourceIndex >= templates.length || targetIndex >= templates.length ||
        sourceIndex === targetIndex) {
        return null;
    }

    const reordered = templates.slice();
    const [template] = reordered.splice(sourceIndex, 1);
    if (!template) return null;
    reordered.splice(targetIndex, 0, template);
    return reordered;
}

/** Serializable, ordered descriptors for PSDs registered with one project. */
export default class ProjectTemplateRegistry {

    constructor(entries = []) {
        this.entries = ProjectTemplateRegistry.normalize(entries);
    }

    static normalize(entries = []) {
        const seen = new Set();
        return entries.reduce((result, entry, index) => {
            if (!entry) return result;
            const fileReference = String(entry.fileReference || entry.fileName || "");
            if (!fileReference || seen.has(fileReference)) return result;
            seen.add(fileReference);
            const validationState = normalizeTemplateRegistryValidationState(
                entry.validationState
            );
            result.push(Object.freeze({
                id: (typeof entry.id === "string" && entry.id.trim() && !/^\s*\[object/i.test(entry.id))
                    ? entry.id.trim()
                    : (typeof entry.id === "number"
                        ? String(entry.id)
                        : (typeof crypto !== "undefined" && crypto.randomUUID
                            ? crypto.randomUUID()
                            : `template_${index + 1}_${fileReference.replace(/[^A-Za-z0-9_-]/g, "_")}`)),
                name: entry.name || entry.fileName || "PSD Template",
                fileReference,
                fileName: entry.fileName || entry.name || "",
                diagnosticId: entry.diagnosticId || entry.fileName || entry.name || "",
                registrationOrder: Number.isInteger(entry.registrationOrder) ? entry.registrationOrder : result.length,
                validationState,
                validationReason: normalizeTemplateRegistryValidationReason(
                    entry.validationReason,
                    validationState
                ),
                validationObservedAt:
                    typeof entry.validationObservedAt === "string"
                        ? entry.validationObservedAt
                        : null,
                validationSchemaVersion:
                    Number.isInteger(entry.validationSchemaVersion)
                        ? entry.validationSchemaVersion
                        : TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION,
                ...(Array.isArray(entry.smartObjects) && entry.smartObjects.length > 0 ? {
                    smartObjects: Object.freeze(entry.smartObjects.map(slot => Object.freeze({
                        layerId: slot?.layerId ?? slot?.id,
                        layerName: slot?.layerName || slot?.name || ""
                    })))
                } : {}),
                ...(Number.isInteger(entry.slotCount) ? { slotCount: entry.slotCount } : (Array.isArray(entry.smartObjects) && entry.smartObjects.length > 0 ? { slotCount: entry.smartObjects.length } : {}))
            }));
            return result;
        }, []).sort((left, right) => left.registrationOrder - right.registrationOrder);
    }

    add(file, validationState = TemplateRegistryValidationState.UNKNOWN, options = {}) {
        // Templates are project-owned files, so their file name is the durable,
        // project-relative reference; native paths are intentionally not persisted.
        const fileReference = String(file?.name || "");
        if (!fileReference) throw new Error("Select a PSD template file.");
        if (this.entries.some(entry => entry.fileReference === fileReference || entry.fileName === file?.name)) {
            throw new Error("That PSD is already registered with this project.");
        }
        const smartObjects = Array.isArray(options?.smartObjects) && options.smartObjects.length > 0
            ? options.smartObjects
            : (Array.isArray(file?.smartObjects) && file.smartObjects.length > 0 ? file.smartObjects : []);
        const slotCount = Number.isInteger(options?.slotCount)
            ? options.slotCount
            : (smartObjects.length > 0 ? smartObjects.length : undefined);
        const descriptor = Object.freeze({
            id: (typeof options?.id === "string" && options.id.trim())
                ? options.id.trim()
                : (typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `template_${Date.now()}_${Math.random().toString(36).slice(2)}`),
            name: file.name || "PSD Template",
            fileReference,
            fileName: file.name || "",
            diagnosticId: file.name || "PSD Template",
            registrationOrder: this.entries.length,
            validationState: normalizeTemplateRegistryValidationState(validationState),
            validationReason: TemplateRegistryValidationReason.NOT_VALIDATED,
            validationObservedAt: null,
            validationSchemaVersion: TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION,
            ...(smartObjects.length > 0 ? {
                smartObjects: Object.freeze(smartObjects.map(slot => Object.freeze({
                    layerId: slot?.layerId ?? slot?.id,
                    layerName: slot?.layerName || slot?.name || ""
                })))
            } : {}),
            ...(slotCount != null ? { slotCount } : {})
        });
        this.entries = [...this.entries, descriptor];
        return descriptor;
    }

    remove(id) {
        const before = this.entries.length;
        this.entries = this.entries.filter(entry => entry.id !== id)
            .map((entry, registrationOrder) => Object.freeze({ ...entry, registrationOrder }));
        return before !== this.entries.length;
    }

    move(id, targetIndex) {
        const sourceIndex = this.entries.findIndex(entry => entry.id === id);
        const reordered = reorderTemplates(this.entries, sourceIndex, targetIndex);
        if (!reordered) return null;
        this.entries = reordered.map((entry, registrationOrder) =>
            Object.freeze({ ...entry, registrationOrder })
        );
        return this.getAll();
    }

    updateValidation(id, validationState) {
        const compatibleState = validationState === "VALID"
            ? TemplateRegistryValidationState.READY
            : normalizeTemplateRegistryValidationState(validationState);
        this.entries = this.entries.map(entry => entry.id === id
            ? Object.freeze({
                ...entry,
                validationState: compatibleState,
                validationReason: normalizeTemplateRegistryValidationReason(
                    null,
                    compatibleState
                ),
                validationObservedAt: new Date().toISOString(),
                validationSchemaVersion: TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION
            })
            : entry);
    }

    snapshot() {
        return Object.freeze(this.entries.map(entry => Object.freeze({ ...entry })));
    }

    restore(snapshot = []) {
        this.entries = ProjectTemplateRegistry.normalize(snapshot);
        return this.getAll();
    }

    applyValidationResults(
        results = [],
        {
            observedAt = new Date().toISOString(),
            schemaVersion = TEMPLATE_REGISTRY_VALIDATION_SCHEMA_VERSION
        } = {}
    ) {
        const byId = new Map(results.map(result => [result?.templateId, result]));
        const changedTemplateIds = [];

        this.entries = this.entries.map(entry => {
            const result = byId.get(entry.id);
            if (!result) return entry;
            const validationState = normalizeTemplateRegistryValidationState(
                result.state
            );
            const validationReason = normalizeTemplateRegistryValidationReason(
                result.reasonCode,
                validationState
            );
            const changed = entry.validationState !== validationState ||
                entry.validationReason !== validationReason ||
                entry.validationSchemaVersion !== schemaVersion;
            if (!changed) return entry;
            changedTemplateIds.push(entry.id);
            return Object.freeze({
                ...entry,
                validationState,
                validationReason,
                validationObservedAt: observedAt,
                validationSchemaVersion: schemaVersion
            });
        });

        return Object.freeze({
            entries: Object.freeze(this.getAll()),
            changedTemplateIds: Object.freeze(changedTemplateIds)
        });
    }

    hasSameIdentityAndOrder(snapshot = []) {
        if (!Array.isArray(snapshot) || snapshot.length !== this.entries.length) {
            return false;
        }
        return this.entries.every((entry, index) => {
            const previous = snapshot[index];
            return previous?.id === entry.id &&
                previous?.fileReference === entry.fileReference &&
                previous?.registrationOrder === entry.registrationOrder;
        });
    }

    blockingEntries() {
        return this.entries.filter(entry =>
            isBlockingTemplateRegistryValidationState(entry.validationState)
        );
    }

    getAll() { return this.entries.slice(); }
    count() { return this.entries.length; }
    toJSON() { return this.getAll(); }
}
