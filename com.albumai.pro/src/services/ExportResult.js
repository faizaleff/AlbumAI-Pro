export const ExportStatus = Object.freeze({
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    SKIPPED: "SKIPPED"
});

export default class ExportResult {

    constructor(data = {}) {

        return ExportResult.freeze({
            templateId: data.templateId ?? null,
            documentId: data.documentId ?? null,
            format: data.format || "JPEG",
            status: data.status || ExportStatus.SKIPPED,
            outputPath: data.outputPath || "",
            exportedAt: data.exportedAt || null,
            warnings: data.warnings || [],
            error: data.error || null
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => ExportResult.freeze(item));

        return Object.freeze(value);

    }

}
