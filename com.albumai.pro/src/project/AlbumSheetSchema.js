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

export const AlbumSheetMutationIntent = Object.freeze({
    ADD: "ADD",
    REMOVE: "REMOVE",
    RENAME: "RENAME",
    MOVE: "MOVE",
    DUPLICATE: "DUPLICATE",
    RESTORE: "RESTORE",
    ASSIGN_SLOT: "ASSIGN_SLOT",
    UNASSIGN_SLOT: "UNASSIGN_SLOT",
    SWAP_SLOTS: "SWAP_SLOTS",
    SET_SLOT_CROP: "SET_SLOT_CROP",
    SET_SHEETS: "SET_SHEETS"
});

export const AlbumSheetMutationReason = Object.freeze({
    INVALID_HISTORY: "INVALID_HISTORY",
    INVALID_MUTATION: "INVALID_MUTATION",
    UNSUPPORTED_MUTATION: "UNSUPPORTED_MUTATION",
    SHEET_NOT_FOUND: "SHEET_NOT_FOUND",
    SHEET_ALREADY_EXISTS: "SHEET_ALREADY_EXISTS",
    TEMPLATE_NOT_REGISTERED: "TEMPLATE_NOT_REGISTERED",
    INVALID_TARGET_POSITION: "INVALID_TARGET_POSITION",
    NO_CHANGE: "NO_CHANGE"
});

const MAX_SHEETS = 500;
const MAX_IDENTIFIER_LENGTH = 120;
const MAX_LABEL_LENGTH = 160;
const MAX_HISTORY_SNAPSHOTS = 20;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SHEET_FIELDS = new Set(["id", "templateId", "label", "slots"]);

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

/**
 * Apply one detached Sheet command without changing the supplied Album.
 * Template readiness is intentionally not evaluated here: the compatibility
 * resolver remains the sole source of renderability state.
 */
export function applyAlbumSheetMutation(album, mutation, options = {}) {

    const inspected = inspectAlbum(album);

    if (!inspected.valid) {
        return mutationRejected(inspected.reasonCodes, album);
    }

    if (!isObject(mutation) || typeof mutation.intent !== "string") {
        return mutationRejected([AlbumSheetMutationReason.INVALID_MUTATION], inspected.album);
    }

    const sheets = inspected.album.sheets;
    const sheetIndex = sheets.findIndex(sheet => sheet.id === mutation.sheetId);
    let nextSheets = null;

    switch (mutation.intent) {
        case AlbumSheetMutationIntent.ADD: {
            const candidate = inspectSheet(mutation.sheet, new Set(sheets.map(sheet => sheet.id)));

            if (!candidate.valid) {
                return mutationRejected(candidate.reasonCodes, inspected.album);
            }

            if (!isRegisteredTemplate(candidate.sheet.templateId, options?.templateIds)) {
                return mutationRejected([
                    AlbumSheetMutationReason.TEMPLATE_NOT_REGISTERED
                ], inspected.album);
            }

            nextSheets = [...sheets, candidate.sheet];
            break;
        }

        case AlbumSheetMutationIntent.REMOVE:
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            nextSheets = sheets.filter(sheet => sheet.id !== mutation.sheetId);
            break;

        case AlbumSheetMutationIntent.RENAME: {
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            if (typeof mutation.label !== "string" ||
                !mutation.label.trim() || mutation.label.length > MAX_LABEL_LENGTH) {
                return mutationRejected([AlbumSheetReason.INVALID_SHEET_LABEL], inspected.album);
            }
            const candidate = inspectSheet({
                ...sheets[sheetIndex],
                label: mutation.label
            }, new Set());

            if (!candidate.valid) {
                return mutationRejected(candidate.reasonCodes, inspected.album);
            }
            if (candidate.sheet.label === sheets[sheetIndex].label) {
                return mutationUnchanged(inspected.album);
            }
            nextSheets = sheets.map((sheet, index) => index === sheetIndex ? candidate.sheet : sheet);
            break;
        }

        case AlbumSheetMutationIntent.MOVE: {
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            if (!Number.isInteger(mutation.targetIndex) ||
                mutation.targetIndex < 0 || mutation.targetIndex >= sheets.length) {
                return mutationRejected([
                    AlbumSheetMutationReason.INVALID_TARGET_POSITION
                ], inspected.album);
            }
            if (mutation.targetIndex === sheetIndex) {
                return mutationUnchanged(inspected.album);
            }
            nextSheets = [...sheets];
            const [sheet] = nextSheets.splice(sheetIndex, 1);
            nextSheets.splice(mutation.targetIndex, 0, sheet);
            break;
        }

        case AlbumSheetMutationIntent.DUPLICATE: {
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            const source = sheets[sheetIndex];
            const candidate = inspectSheet({
                ...source,
                id: mutation.newSheetId
            }, new Set(sheets.map(sheet => sheet.id)));

            if (!candidate.valid) {
                return mutationRejected(candidate.reasonCodes, inspected.album);
            }
            nextSheets = [...sheets, candidate.sheet];
            break;
        }

        case AlbumSheetMutationIntent.ASSIGN_SLOT: {
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            if (mutation.slotId == null || mutation.photoId == null) {
                return mutationRejected([AlbumSheetMutationReason.INVALID_MUTATION], inspected.album);
            }
            const targetSheet = sheets[sheetIndex];
            const slotId = typeof mutation.slotId === "number" ? mutation.slotId : String(mutation.slotId);
            const photoId = String(mutation.photoId);
            const cropFocus = typeof mutation.cropFocus === "string" &&
                ["center", "top", "bottom", "left", "right"].includes(mutation.cropFocus)
                ? mutation.cropFocus
                : "center";
            const currentSlots = Array.isArray(targetSheet.slots) ? targetSheet.slots : [];
            const remaining = currentSlots.filter(s => String(s.slotId) !== String(slotId));
            const nextSlotList = [...remaining, { slotId, photoId, cropFocus }];
            const candidate = inspectSheet({
                ...targetSheet,
                slots: nextSlotList
            }, new Set());
            if (!candidate.valid) {
                return mutationRejected(candidate.reasonCodes, inspected.album);
            }
            nextSheets = sheets.map((sheet, index) => index === sheetIndex ? candidate.sheet : sheet);
            break;
        }

        case AlbumSheetMutationIntent.UNASSIGN_SLOT: {
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            const targetSheet = sheets[sheetIndex];
            const currentSlots = Array.isArray(targetSheet.slots) ? targetSheet.slots : [];
            const nextSlotList = currentSlots.filter(s => String(s.slotId) !== String(mutation.slotId));
            if (nextSlotList.length === currentSlots.length) {
                return mutationUnchanged(inspected.album);
            }
            const candidate = inspectSheet({
                ...targetSheet,
                slots: nextSlotList
            }, new Set());
            if (!candidate.valid) {
                return mutationRejected(candidate.reasonCodes, inspected.album);
            }
            nextSheets = sheets.map((sheet, index) => index === sheetIndex ? candidate.sheet : sheet);
            break;
        }

        case AlbumSheetMutationIntent.SWAP_SLOTS: {
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            const targetSheet = sheets[sheetIndex];
            const currentSlots = Array.isArray(targetSheet.slots) ? targetSheet.slots : [];
            const slotA = currentSlots.find(s => String(s.slotId) === String(mutation.slotIdA));
            const slotB = currentSlots.find(s => String(s.slotId) === String(mutation.slotIdB));
            if (!slotA && !slotB) {
                return mutationUnchanged(inspected.album);
            }
            const remaining = currentSlots.filter(s =>
                String(s.slotId) !== String(mutation.slotIdA) && String(s.slotId) !== String(mutation.slotIdB)
            );
            const nextSlotList = [...remaining];
            if (slotA) {
                nextSlotList.push({ ...slotA, slotId: mutation.slotIdB });
            }
            if (slotB) {
                nextSlotList.push({ ...slotB, slotId: mutation.slotIdA });
            }
            const candidate = inspectSheet({
                ...targetSheet,
                slots: nextSlotList
            }, new Set());
            if (!candidate.valid) {
                return mutationRejected(candidate.reasonCodes, inspected.album);
            }
            nextSheets = sheets.map((sheet, index) => index === sheetIndex ? candidate.sheet : sheet);
            break;
        }

        case AlbumSheetMutationIntent.SET_SLOT_CROP: {
            if (sheetIndex < 0) {
                return mutationRejected([AlbumSheetMutationReason.SHEET_NOT_FOUND], inspected.album);
            }
            const targetSheet = sheets[sheetIndex];
            const currentSlots = Array.isArray(targetSheet.slots) ? targetSheet.slots : [];
            const targetSlot = currentSlots.find(s => String(s.slotId) === String(mutation.slotId));
            if (!targetSlot) {
                return mutationUnchanged(inspected.album);
            }
            const cropFocus = typeof mutation.cropFocus === "string" &&
                ["center", "top", "bottom", "left", "right"].includes(mutation.cropFocus)
                ? mutation.cropFocus
                : "center";
            if (targetSlot.cropFocus === cropFocus) {
                return mutationUnchanged(inspected.album);
            }
            const remaining = currentSlots.filter(s => String(s.slotId) !== String(mutation.slotId));
            const nextSlotList = [...remaining, { ...targetSlot, cropFocus }];
            const candidate = inspectSheet({
                ...targetSheet,
                slots: nextSlotList
            }, new Set());
            if (!candidate.valid) {
                return mutationRejected(candidate.reasonCodes, inspected.album);
            }
            nextSheets = sheets.map((sheet, index) => index === sheetIndex ? candidate.sheet : sheet);
            break;
        }

        case AlbumSheetMutationIntent.SET_SHEETS: {
            if (!Array.isArray(mutation.sheets)) {
                return mutationRejected([AlbumSheetMutationReason.INVALID_MUTATION], inspected.album);
            }
            const candidateAlbum = inspectAlbum({
                schemaVersion: ALBUM_SCHEMA_VERSION,
                sheets: mutation.sheets
            });
            if (!candidateAlbum.valid) {
                return mutationRejected(candidateAlbum.reasonCodes, inspected.album);
            }
            if (options?.templateIds) {
                for (const sheet of candidateAlbum.album.sheets) {
                    if (!isRegisteredTemplate(sheet.templateId, options.templateIds)) {
                        return mutationRejected([
                            AlbumSheetMutationReason.TEMPLATE_NOT_REGISTERED
                        ], inspected.album);
                    }
                }
            }
            nextSheets = candidateAlbum.album.sheets;
            break;
        }

        case AlbumSheetMutationIntent.RESTORE: {
            const restored = inspectAlbum(mutation.album);
            if (restored.valid && albumsEqual(restored.album, inspected.album)) {
                return mutationUnchanged(inspected.album);
            }
            return restored.valid
                ? mutationAccepted(restored.album)
                : mutationRejected(restored.reasonCodes, inspected.album);
        }

        default:
            return mutationRejected([
                AlbumSheetMutationReason.UNSUPPORTED_MUTATION
            ], inspected.album);
    }

    const next = inspectAlbum({
        schemaVersion: ALBUM_SCHEMA_VERSION,
        sheets: nextSheets
    });

    return next.valid
        ? mutationAccepted(next.album)
        : mutationRejected(next.reasonCodes, inspected.album);

}

/**
 * A bounded, detached undo/redo cursor. It stores only canonical Album
 * snapshots and never crosses into UXP, Photoshop, photos, or output state.
 */
export function createAlbumSheetHistory(album) {

    const inspected = inspectAlbum(album);

    if (!inspected.valid) {
        return null;
    }

    return freezeHistory({
        past: [],
        present: inspected.album,
        future: []
    });

}

export function applyAlbumSheetHistoryMutation(history, mutation, options = {}) {

    if (!isHistory(history)) {
        return Object.freeze({
            accepted: false,
            changed: false,
            reasonCodes: Object.freeze([AlbumSheetMutationReason.INVALID_HISTORY]),
            history: null
        });
    }

    const result = applyAlbumSheetMutation(history.present, mutation, options);

    if (!result.accepted || !result.changed) {
        return Object.freeze({ ...result, history });
    }

    return Object.freeze({
        ...result,
        history: freezeHistory({
            past: [...history.past, history.present].slice(-MAX_HISTORY_SNAPSHOTS),
            present: result.album,
            future: []
        })
    });

}

export function undoAlbumSheetHistory(history) {

    if (!isHistory(history)) {
        return invalidHistoryResult();
    }
    if (!history.past.length) {
        return Object.freeze({ accepted: true, changed: false, history });
    }

    const past = [...history.past];
    const present = past.pop();
    return Object.freeze({
        accepted: true,
        changed: true,
        history: freezeHistory({
            past,
            present,
            future: [history.present, ...history.future].slice(0, MAX_HISTORY_SNAPSHOTS)
        })
    });

}

export function redoAlbumSheetHistory(history) {

    if (!isHistory(history)) {
        return invalidHistoryResult();
    }
    if (!history.future.length) {
        return Object.freeze({ accepted: true, changed: false, history });
    }

    const future = [...history.future];
    const present = future.shift();
    return Object.freeze({
        accepted: true,
        changed: true,
        history: freezeHistory({
            past: [...history.past, history.present].slice(-MAX_HISTORY_SNAPSHOTS),
            present,
            future
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

    if (Array.isArray(sheet.slots)) {
        const validSlots = [];
        for (const slot of sheet.slots) {
            if (!isObject(slot) || slot.slotId == null || slot.photoId == null) continue;
            const slotId = typeof slot.slotId === "number" ? slot.slotId : String(slot.slotId);
            const photoId = String(slot.photoId);
            const cropFocus = typeof slot.cropFocus === "string" &&
                ["center", "top", "bottom", "left", "right"].includes(slot.cropFocus)
                ? slot.cropFocus
                : "center";
            validSlots.push(Object.freeze({ slotId, photoId, cropFocus }));
        }
        if (validSlots.length > 0) {
            normalized.slots = Object.freeze(validSlots);
        }
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

function isRegisteredTemplate(templateId, templateIds) {

    return Array.isArray(templateIds) && templateIds.includes(templateId);

}

function slotsEqual(left = [], right = []) {
    const l = Array.isArray(left) ? left : [];
    const r = Array.isArray(right) ? right : [];
    if (l.length !== r.length) return false;
    return l.every((slot, i) =>
        String(slot.slotId) === String(r[i].slotId) &&
        String(slot.photoId) === String(r[i].photoId) &&
        String(slot.cropFocus || "center") === String(r[i].cropFocus || "center")
    );
}

function albumsEqual(left, right) {

    return left.schemaVersion === right.schemaVersion &&
        left.sheets.length === right.sheets.length &&
        left.sheets.every((sheet, index) =>
            sheet.id === right.sheets[index].id &&
            sheet.templateId === right.sheets[index].templateId &&
            sheet.label === right.sheets[index].label &&
            slotsEqual(sheet.slots, right.sheets[index].slots)
        );

}

function mutationAccepted(album) {

    return Object.freeze({
        accepted: true,
        changed: true,
        reasonCodes: Object.freeze([]),
        album
    });

}

function mutationUnchanged(album) {

    return Object.freeze({
        accepted: true,
        changed: false,
        reasonCodes: Object.freeze([AlbumSheetMutationReason.NO_CHANGE]),
        album
    });

}

function mutationRejected(reasonCodes, album) {

    return Object.freeze({
        accepted: false,
        changed: false,
        reasonCodes: Object.freeze([...reasonCodes]),
        album
    });

}

function isHistory(history) {

    return isObject(history) &&
        Array.isArray(history.past) &&
        Array.isArray(history.future) &&
        history.past.length <= MAX_HISTORY_SNAPSHOTS &&
        history.future.length <= MAX_HISTORY_SNAPSHOTS &&
        inspectAlbum(history.present).valid &&
        history.past.every(snapshot => inspectAlbum(snapshot).valid) &&
        history.future.every(snapshot => inspectAlbum(snapshot).valid);

}

function freezeHistory(history) {

    return Object.freeze({
        past: Object.freeze([...history.past]),
        present: history.present,
        future: Object.freeze([...history.future])
    });

}

function invalidHistoryResult() {

    return Object.freeze({
        accepted: false,
        changed: false,
        reasonCodes: Object.freeze([AlbumSheetMutationReason.INVALID_HISTORY]),
        history: null
    });

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
