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
            result.push(Object.freeze({
                id: entry.id || `template-${index + 1}-${fileReference}`,
                name: entry.name || entry.fileName || "PSD Template",
                fileReference,
                fileName: entry.fileName || entry.name || "",
                diagnosticId: entry.diagnosticId || entry.fileName || entry.name || "",
                registrationOrder: Number.isInteger(entry.registrationOrder) ? entry.registrationOrder : result.length,
                validationState: entry.validationState || "UNKNOWN"
            }));
            return result;
        }, []).sort((left, right) => left.registrationOrder - right.registrationOrder);
    }

    add(file, validationState = "UNKNOWN") {
        // Templates are project-owned files, so their file name is the durable,
        // project-relative reference; native paths are intentionally not persisted.
        const fileReference = String(file?.name || "");
        if (!fileReference) throw new Error("Select a PSD template file.");
        if (this.entries.some(entry => entry.fileReference === fileReference || entry.fileName === file?.name)) {
            throw new Error("That PSD is already registered with this project.");
        }
        const descriptor = Object.freeze({
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            name: file.name || "PSD Template",
            fileReference,
            fileName: file.name || "",
            diagnosticId: file.name || "PSD Template",
            registrationOrder: this.entries.length,
            validationState
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
        this.entries = this.entries.map(entry => entry.id === id
            ? Object.freeze({ ...entry, validationState })
            : entry);
    }

    getAll() { return this.entries.slice(); }
    count() { return this.entries.length; }
    toJSON() { return this.getAll(); }
}
