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

function freezeAlbum(album) {

    return Object.freeze({
        schemaVersion: album.schemaVersion,
        sheets: Object.freeze(album.sheets.map(sheet => Object.freeze({ ...sheet })))
    });

}
