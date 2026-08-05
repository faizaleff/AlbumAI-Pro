import {
    TemplateRegistryValidationReason,
    TemplateRegistryValidationState,
    isBlockingTemplateRegistryValidationState
} from "../project/TemplateRegistryValidationState";

const PSD_EXTENSION = /\.psd$/i;

/**
 * Pure basic availability validation for persisted project-template descriptors.
 *
 * This service operates only on supplied folder-entry values. It does not call
 * UXP, Photoshop, DocumentManager, or TemplateDocumentReader, and it never
 * exposes entry paths/tokens in its results.
 */
export default class TemplateRegistryPreflightService {

    validate({ descriptors, workspaceTemplates } = {}) {
        const orderedDescriptors = Array.isArray(descriptors)
            ? descriptors.slice()
            : [];
        const entries = Array.isArray(workspaceTemplates)
            ? workspaceTemplates.slice()
            : [];
        const inspection = this.inspectEntries(entries);
        const results = orderedDescriptors.map((descriptor, index) =>
            this.validateDescriptor(descriptor, index, inspection)
        );

        return Object.freeze({
            results: Object.freeze(results),
            blockingTemplateIds: Object.freeze(results
                .filter(result => result.blocking)
                .map(result => result.templateId))
        });
    }

    inspectEntries(entries) {
        const psdEntries = [];
        const inaccessibleNames = new Set();

        entries.forEach(entry => {
            let name;
            try {
                name = entry?.name;
            } catch (_error) {
                // Without a readable name this entry cannot be associated with
                // any descriptor. Do not turn unrelated descriptors into an
                // ACCESS_ERROR merely because another entry is unreadable.
                return;
            }

            if (typeof name !== "string" || !PSD_EXTENSION.test(name)) return;

            let isFile;
            try {
                isFile = entry?.isFile;
            } catch (_error) {
                inaccessibleNames.add(name);
                return;
            }

            if (!isFile) return;

            let nativePath = null;
            try {
                nativePath = typeof entry?.nativePath === "string"
                    ? entry.nativePath
                    : null;
            } catch (_error) {
                // A filename match can still be established safely. NativePath
                // is an optional stronger identity in the current repository.
                nativePath = null;
            }

            psdEntries.push(Object.freeze({ name, nativePath }));
        });

        return Object.freeze({
            psdEntries: Object.freeze(psdEntries),
            inaccessibleNames
        });
    }

    validateDescriptor(descriptor, index, inspection) {
        const templateId = descriptor?.id || `template-${index + 1}`;
        const fileReference = this.string(descriptor?.fileReference);
        const fileName = this.string(descriptor?.fileName || descriptor?.name);

        // Existing resolution checks nativePath against fileReference first.
        // Preserve that stronger, case-sensitive identity when it yields a
        // unique candidate; only then use the existing filename fallback.
        const referenceMatches = fileReference
            ? inspection.psdEntries.filter(entry => entry.nativePath === fileReference)
            : [];
        const fallbackNames = new Set([fileReference, fileName].filter(Boolean));
        const nameMatches = inspection.psdEntries.filter(entry =>
            fallbackNames.has(entry.name)
        );
        const matches = referenceMatches.length
            ? referenceMatches
            : nameMatches;
        const inaccessibleMatch = [...fallbackNames].some(name =>
            inspection.inaccessibleNames.has(name)
        );

        let state;
        let reasonCode;
        if (matches.length > 1) {
            state = TemplateRegistryValidationState.AMBIGUOUS;
            reasonCode = TemplateRegistryValidationReason.MULTIPLE_MATCHES;
        } else if (matches.length === 1) {
            state = TemplateRegistryValidationState.READY;
            reasonCode = TemplateRegistryValidationReason.UNIQUE_MATCH;
        } else if (inaccessibleMatch) {
            // If entry metadata could not be read, fail closed rather than
            // report MISSING and invite an unsafe filename guess.
            state = TemplateRegistryValidationState.ACCESS_ERROR;
            reasonCode = TemplateRegistryValidationReason.STORAGE_INSPECTION_FAILED;
        } else {
            state = TemplateRegistryValidationState.MISSING;
            reasonCode = TemplateRegistryValidationReason.NO_MATCH;
        }

        return Object.freeze({
            templateId,
            state,
            reasonCode,
            blocking: isBlockingTemplateRegistryValidationState(state)
        });
    }

    string(value) {
        return typeof value === "string" && value
            ? value
            : "";
    }
}
