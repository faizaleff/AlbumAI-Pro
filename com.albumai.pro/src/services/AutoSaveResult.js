export const AutoSaveStatus = Object.freeze({
    SAVED: "SAVED",
    SKIPPED: "SKIPPED",
    FAILED: "FAILED"
});

export default class AutoSaveResult {

    constructor(data = {}) {

        return AutoSaveResult.freeze({
            templateId: data.templateId ?? null,
            documentId: data.documentId ?? null,
            mode: data.mode || "SAVE_COPY",
            status: data.status || AutoSaveStatus.SKIPPED,
            sourcePath: data.sourcePath || "",
            outputPath: data.outputPath || "",
            savedAt: data.savedAt || null,
            warnings: data.warnings || [],
            error: data.error || null,
            outputTransaction: data.outputTransaction || null
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => AutoSaveResult.freeze(item));

        return Object.freeze(value);

    }

}
