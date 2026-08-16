import {
    AlbumSheetTemplateState,
    inspectAlbum,
    resolveAlbumSheetTemplates
} from "./AlbumSheetSchema";

export const ALBUM_SHEET_RENDER_REQUEST_SCHEMA_VERSION = 1;

export const AlbumSheetRenderReason = Object.freeze({
    INVALID_PROJECT: "INVALID_PROJECT",
    INVALID_SHEET_ID: "INVALID_SHEET_ID",
    INVALID_SELECTED_PHOTOS: "INVALID_SELECTED_PHOTOS",
    NO_SELECTED_PHOTOS: "NO_SELECTED_PHOTOS",
    SHEET_NOT_FOUND: "SHEET_NOT_FOUND",
    SHEET_NOT_RENDERABLE: "SHEET_NOT_RENDERABLE",
    INVALID_RENDER_REQUEST: "INVALID_RENDER_REQUEST",
    PROJECT_MISMATCH: "PROJECT_MISMATCH",
    SHEET_STALE: "SHEET_STALE",
    TEMPLATE_REGISTRY_STALE: "TEMPLATE_REGISTRY_STALE",
    PHOTO_SELECTION_STALE: "PHOTO_SELECTION_STALE"
});

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const PHOTO_ID_MAX_LENGTH = 2048;
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

/**
 * Build a detached, serializable request for exactly one Album Sheet.  This
 * boundary intentionally contains only stable IDs and validation facts; host
 * entries, Photoshop documents, and photos stay with the existing execution
 * owners. Photo IDs are opaque because the current photo owner may use a
 * filename or a host-backed path as its stable identifier.
 */
export function createAlbumSheetRenderRequest({
    projectId,
    album,
    registry,
    sheetId,
    selectedPhotoIds
} = {}) {
    const reasonCodes = [];

    if (!isIdentifier(projectId)) {
        reasonCodes.push(AlbumSheetRenderReason.INVALID_PROJECT);
    }
    if (!isIdentifier(sheetId)) {
        reasonCodes.push(AlbumSheetRenderReason.INVALID_SHEET_ID);
    }

    const selected = inspectSelectedPhotoIds(selectedPhotoIds);
    if (!selected.valid) {
        reasonCodes.push(selected.reasonCode);
    }

    const inspected = inspectAlbum(album);
    if (!inspected.valid) {
        return rejected([...reasonCodes, ...inspected.reasonCodes]);
    }
    if (reasonCodes.length) return rejected(reasonCodes);

    const sheet = inspected.album.sheets.find(candidate => candidate.id === sheetId);
    if (!sheet) return rejected([AlbumSheetRenderReason.SHEET_NOT_FOUND]);

    const compatibility = resolveAlbumSheetTemplates(inspected.album, registry);
    const resolved = compatibility.sheets.find(candidate => candidate.sheetId === sheetId);
    if (!resolved || resolved.state !== AlbumSheetTemplateState.READY) {
        return rejected([
            AlbumSheetRenderReason.SHEET_NOT_RENDERABLE,
            ...(resolved?.reasonCode ? [resolved.reasonCode] : compatibility.reasonCodes)
        ]);
    }

    return accepted({
        schemaVersion: ALBUM_SHEET_RENDER_REQUEST_SCHEMA_VERSION,
        projectId,
        sheet: Object.freeze({
            id: sheet.id,
            templateId: sheet.templateId,
            label: sheet.label || ""
        }),
        template: templateSnapshot(resolved, registry),
        selectedPhotoIds: selected.photoIds
    });
}

/**
 * Rebuild the detached request from current canonical facts.  Execution must
 * call this immediately before handing work to the existing batch owner so a
 * changed project, Sheet, registry, or browser selection fails closed.
 */
export function validateAlbumSheetRenderRequest(request, context = {}) {
    if (!isRequestShape(request)) {
        return rejected([AlbumSheetRenderReason.INVALID_RENDER_REQUEST]);
    }

    const current = createAlbumSheetRenderRequest({
        projectId: context.projectId,
        album: context.album,
        registry: context.registry,
        sheetId: request.sheet.id,
        selectedPhotoIds: context.selectedPhotoIds
    });
    if (!current.accepted) return current;

    const reasonCodes = [];
    if (request.projectId !== current.request.projectId) {
        reasonCodes.push(AlbumSheetRenderReason.PROJECT_MISMATCH);
    }
    if (!sameSheet(request.sheet, current.request.sheet)) {
        reasonCodes.push(AlbumSheetRenderReason.SHEET_STALE);
    }
    if (!sameTemplate(request.template, current.request.template)) {
        reasonCodes.push(AlbumSheetRenderReason.TEMPLATE_REGISTRY_STALE);
    }
    if (!sameArray(request.selectedPhotoIds, current.request.selectedPhotoIds)) {
        reasonCodes.push(AlbumSheetRenderReason.PHOTO_SELECTION_STALE);
    }

    return reasonCodes.length ? rejected(reasonCodes) : accepted(current.request);
}

function inspectSelectedPhotoIds(photoIds) {
    if (!Array.isArray(photoIds)) {
        return { valid: false, reasonCode: AlbumSheetRenderReason.INVALID_SELECTED_PHOTOS };
    }
    if (!photoIds.length) {
        return { valid: false, reasonCode: AlbumSheetRenderReason.NO_SELECTED_PHOTOS };
    }
    const ids = photoIds.map(id => typeof id === "string" ? id : "");
    if (ids.some(id => !isOpaquePhotoId(id)) || new Set(ids).size !== ids.length) {
        return { valid: false, reasonCode: AlbumSheetRenderReason.INVALID_SELECTED_PHOTOS };
    }
    return { valid: true, photoIds: Object.freeze(ids.slice()) };
}

function templateSnapshot(resolved, registry) {
    const template = Array.isArray(registry)
        ? registry.find(entry => entry?.id === resolved.templateId)
        : null;
    return Object.freeze({
        id: resolved.templateId,
        registrationOrder: Number.isInteger(resolved.templateRegistrationOrder)
            ? resolved.templateRegistrationOrder
            : null,
        validationState: typeof template?.validationState === "string"
            ? template.validationState
            : null,
        validationReason: typeof template?.validationReason === "string"
            ? template.validationReason
            : null,
        validationSchemaVersion: Number.isInteger(template?.validationSchemaVersion)
            ? template.validationSchemaVersion
            : null
    });
}

function isRequestShape(request) {
    return request && typeof request === "object" &&
        request.schemaVersion === ALBUM_SHEET_RENDER_REQUEST_SCHEMA_VERSION &&
        isIdentifier(request.projectId) &&
        request.sheet && isIdentifier(request.sheet.id) &&
        isIdentifier(request.sheet.templateId) &&
        request.template && request.template.id === request.sheet.templateId &&
        Array.isArray(request.selectedPhotoIds);
}

function isIdentifier(value) {
    return typeof value === "string" && IDENTIFIER.test(value);
}

function isOpaquePhotoId(value) {
    return typeof value === "string" &&
        value.length > 0 &&
        value.length <= PHOTO_ID_MAX_LENGTH &&
        !CONTROL_CHARACTER.test(value);
}

function sameSheet(left, right) {
    return left?.id === right?.id &&
        left?.templateId === right?.templateId &&
        left?.label === right?.label;
}

function sameTemplate(left, right) {
    return left?.id === right?.id &&
        left?.registrationOrder === right?.registrationOrder &&
        left?.validationState === right?.validationState &&
        left?.validationReason === right?.validationReason &&
        left?.validationSchemaVersion === right?.validationSchemaVersion;
}

function sameArray(left, right) {
    return Array.isArray(left) && Array.isArray(right) &&
        left.length === right.length && left.every((item, index) => item === right[index]);
}

function accepted(request) {
    return Object.freeze({
        accepted: true,
        reasonCodes: Object.freeze([]),
        request: freezeRequest(request)
    });
}

function rejected(reasonCodes) {
    return Object.freeze({
        accepted: false,
        reasonCodes: Object.freeze([...new Set(reasonCodes)]),
        request: null
    });
}

function freezeRequest(request) {
    const value = {
        ...request,
        sheet: Object.freeze({ ...request.sheet }),
        template: Object.freeze({ ...request.template }),
        selectedPhotoIds: Object.freeze(request.selectedPhotoIds.slice())
    };
    return Object.freeze(value);
}
