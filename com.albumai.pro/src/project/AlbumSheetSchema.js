export const ALBUM_SCHEMA_VERSION = 1;

export const AlbumSheetReason = Object.freeze({
    MISSING_ALBUM: "MISSING_ALBUM",
    INVALID_ALBUM: "INVALID_ALBUM",
    UNSUPPORTED_ALBUM_SCHEMA: "UNSUPPORTED_ALBUM_SCHEMA",
    INVALID_SHEETS: "INVALID_SHEETS",
    TOO_MANY_SHEETS: "TOO_MANY_SHEETS",
    INVALID_SHEET: "INVALID_SHEET",
    INVALID_SHEET_ID: "INVALID_SHEET_ID",
    DUPLICATE_SHEET_ID: "DUPLICATE_SHEET_ID",
    INVALID_TEMPLATE_ID: "INVALID_TEMPLATE_ID",
    INVALID_SHEET_LABEL: "INVALID_SHEET_LABEL",
    UNSUPPORTED_SHEET_FIELD: "UNSUPPORTED_SHEET_FIELD"
});

export const AlbumSheetTemplateState = Object.freeze({
    READY: "READY",
    MISSING_TEMPLATE: "MISSING_TEMPLATE",
    TEMPLATE_BLOCKED: "TEMPLATE_BLOCKED",
    STALE_TEMPLATE: "STALE_TEMPLATE",
    UNSUPPORTED_SCHEMA: "UNSUPPORTED_SCHEMA"
});

export const AlbumSheetTemplateReason = Object.freeze({
    READY: "READY",
    TEMPLATE_NOT_REGISTERED: "TEMPLATE_NOT_REGISTERED",
    TEMPLATE_VALIDATION_BLOCKED: "TEMPLATE_VALIDATION_BLOCKED",
    TEMPLATE_VALIDATION_STALE: "TEMPLATE_VALIDATION_STALE",
    TEMPLATE_REGISTRY_UNAVAILABLE: "TEMPLATE_REGISTRY_UNAVAILABLE"
});

const MAX_SHEETS = 500;
const MAX_IDENTIFIER_LENGTH = 120;
const MAX_LABEL_LENGTH = 160;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SHEET_FIELDS = new Set(["id", "templateId", "label"]);

export function createEmptyAlbum() {

    return freezeAlbum({
        schemaVersion: ALBUM_SCHEMA_VERSION,
        sheets: []
    });

}

export function inspectAlbum(album) {

    if (album == null) {
        return invalid(AlbumSheetReason.MISSING_ALBUM);
    }

    if (!isObject(album)) {
        return invalid(AlbumSheetReason.INVALID_ALBUM);
    }

    if (album.schemaVersion !== ALBUM_SCHEMA_VERSION) {
        return invalid(AlbumSheetReason.UNSUPPORTED_ALBUM_SCHEMA);
    }

    if (!Array.isArray(album.sheets)) {
        return invalid(AlbumSheetReason.INVALID_SHEETS);
    }

    if (album.sheets.length > MAX_SHEETS) {
        return invalid(AlbumSheetReason.TOO_MANY_SHEETS);
    }

    const ids = new Set();
    const sheets = [];

    for (const sheet of album.sheets) {
        const inspected = inspectSheet(sheet, ids);

        if (!inspected.valid) {
            return inspected;
        }

        ids.add(inspected.sheet.id);
        sheets.push(inspected.sheet);
    }

    return Object.freeze({
        valid: true,
        reasonCodes: Object.freeze([]),
        album: freezeAlbum({
            schemaVersion: ALBUM_SCHEMA_VERSION,
            sheets
        })
    });

}

/**
 * Resolve Sheet-to-Template compatibility from a detached canonical registry
 * snapshot. No path, file entry, or Photoshop object crosses this boundary.
 */
export function resolveAlbumSheetTemplates(album, registry = null) {

    const inspected = inspectAlbum(album);

    if (!inspected.valid) {
        return compatibility(
            AlbumSheetTemplateState.UNSUPPORTED_SCHEMA,
            inspected.reasonCodes,
            []
        );
    }

    if (!Array.isArray(registry)) {
        const sheets = inspected.album.sheets.map(sheet => sheetCompatibility(
            sheet,
            AlbumSheetTemplateState.TEMPLATE_BLOCKED,
            AlbumSheetTemplateReason.TEMPLATE_REGISTRY_UNAVAILABLE
        ));
        return compatibility(
            AlbumSheetTemplateState.TEMPLATE_BLOCKED,
            [AlbumSheetTemplateReason.TEMPLATE_REGISTRY_UNAVAILABLE],
            sheets
        );
    }

    const templates = new Map();
    registry.forEach(entry => {
        if (isObject(entry) && isIdentifier(entry.id) && !templates.has(entry.id)) {
            templates.set(entry.id, entry);
        }
    });

    const sheets = inspected.album.sheets.map(sheet => {
        const template = templates.get(sheet.templateId);

        if (!template) {
            return sheetCompatibility(
                sheet,
                AlbumSheetTemplateState.MISSING_TEMPLATE,
                AlbumSheetTemplateReason.TEMPLATE_NOT_REGISTERED
            );
        }

        if (template.validationSchemaVersion !== 1) {
            return sheetCompatibility(
                sheet,
                AlbumSheetTemplateState.STALE_TEMPLATE,
                AlbumSheetTemplateReason.TEMPLATE_VALIDATION_STALE,
                template
            );
        }

        if (template.validationState !== "READY") {
            return sheetCompatibility(
                sheet,
                AlbumSheetTemplateState.TEMPLATE_BLOCKED,
                AlbumSheetTemplateReason.TEMPLATE_VALIDATION_BLOCKED,
                template
            );
        }

        return sheetCompatibility(
            sheet,
            AlbumSheetTemplateState.READY,
            AlbumSheetTemplateReason.READY,
            template
        );
    });

    const reasonCodes = [...new Set(sheets
        .filter(sheet => sheet.state !== AlbumSheetTemplateState.READY)
        .map(sheet => sheet.reasonCode))];

    return compatibility(
        reasonCodes.length
            ? AlbumSheetTemplateState.TEMPLATE_BLOCKED
            : AlbumSheetTemplateState.READY,
        reasonCodes,
        sheets
    );

}

function inspectSheet(sheet, ids) {

    if (!isObject(sheet)) {
        return invalid(AlbumSheetReason.INVALID_SHEET);
    }

    for (const field of Object.keys(sheet)) {
        if (!SHEET_FIELDS.has(field)) {
            return invalid(AlbumSheetReason.UNSUPPORTED_SHEET_FIELD);
        }
    }

    if (!isIdentifier(sheet.id)) {
        return invalid(AlbumSheetReason.INVALID_SHEET_ID);
    }

    if (ids.has(sheet.id)) {
        return invalid(AlbumSheetReason.DUPLICATE_SHEET_ID);
    }

    if (!isIdentifier(sheet.templateId)) {
        return invalid(AlbumSheetReason.INVALID_TEMPLATE_ID);
    }

    if (
        sheet.label != null &&
        (typeof sheet.label !== "string" ||
            !sheet.label.trim() ||
            sheet.label.length > MAX_LABEL_LENGTH)
    ) {
        return invalid(AlbumSheetReason.INVALID_SHEET_LABEL);
    }

    const normalized = {
        id: sheet.id,
        templateId: sheet.templateId
    };

    if (sheet.label != null) {
        normalized.label = sheet.label.trim();
    }

    return Object.freeze({
        valid: true,
        reasonCodes: Object.freeze([]),
        sheet: Object.freeze(normalized)
    });

}

function isIdentifier(value) {

    return typeof value === "string" &&
        value.length <= MAX_IDENTIFIER_LENGTH &&
        IDENTIFIER.test(value);

}

function isObject(value) {

    return value && typeof value === "object" && !Array.isArray(value);

}

function invalid(reason) {

    return Object.freeze({
        valid: false,
        reasonCodes: Object.freeze([reason]),
        album: null
    });

}

function compatibility(status, reasonCodes, sheets) {

    return Object.freeze({
        status,
        reasonCodes: Object.freeze([...reasonCodes]),
        sheets: Object.freeze(sheets)
    });

}

function sheetCompatibility(sheet, state, reasonCode, template = null) {

    return Object.freeze({
        sheetId: sheet.id,
        templateId: sheet.templateId,
        state,
        reasonCode,
        templateRegistrationOrder:
            Number.isInteger(template?.registrationOrder) &&
            template.registrationOrder >= 0
                ? template.registrationOrder
                : null
    });

}

function freezeAlbum(album) {

    return Object.freeze({
        schemaVersion: album.schemaVersion,
        sheets: Object.freeze(album.sheets.map(sheet => Object.freeze({ ...sheet })))
    });

}
