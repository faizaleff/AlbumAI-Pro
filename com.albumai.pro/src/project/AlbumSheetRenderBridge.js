import {
    AlbumSheetTemplateState,
    inspectAlbum,
    resolveAlbumSheetTemplates
} from "./AlbumSheetSchema";

export const ALBUM_SHEET_RENDER_REQUEST_SCHEMA_VERSION = 1;
export const ALBUM_BATCH_RENDER_REQUEST_SCHEMA_VERSION = 1;

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
    PHOTO_SELECTION_STALE: "PHOTO_SELECTION_STALE",
    NO_RENDERABLE_SHEETS: "NO_RENDERABLE_SHEETS",
    INCOMPLETE_SPREADS: "INCOMPLETE_SPREADS"
});

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const PHOTO_ID_MAX_LENGTH = 2048;
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

/**
 * Build a detached, serializable request for an entire album batch (all sheets).
 */
export function createAlbumBatchRenderRequest({
    projectId,
    album,
    registry,
    selectedPhotoIds,
    options = {}
} = {}) {
    const inspected = inspectAlbum(album);
    if (!inspected.valid) {
        return rejected(inspected.reasonCodes);
    }

    const sheets = inspected.album.sheets || [];
    if (sheets.length === 0) {
        return rejected([AlbumSheetRenderReason.NO_RENDERABLE_SHEETS]);
    }

    // Safety Gate: Block Lab Print if any spread is incomplete
    const requireComplete = options?.type === "LAB_PRINT" || options?.requireCompleteSpreads === true;
    const incompleteSheets = [];

    for (const sheet of sheets) {
        const template = Array.isArray(registry) ? registry.find(candidate => candidate.id === sheet.templateId) : null;
        const templateSlotCount = (Array.isArray(template?.smartObjects) && template.smartObjects.length > 0)
            ? template.smartObjects.length
            : (Number.isInteger(template?.slotCount) ? template.slotCount : 0);
        const assignedSlotsCount = (Array.isArray(sheet.slots) ? sheet.slots.filter(s => s && s.photoId) : []).length;

        if (templateSlotCount > 0 && assignedSlotsCount < templateSlotCount) {
            incompleteSheets.push({
                sheetId: sheet.id,
                sheetLabel: sheet.label || sheet.id,
                assignedCount: assignedSlotsCount,
                totalCount: templateSlotCount,
                missingCount: templateSlotCount - assignedSlotsCount
            });
        }
    }

    if (requireComplete && incompleteSheets.length > 0) {
        const totalMissing = incompleteSheets.reduce((sum, item) => sum + item.missingCount, 0);
        const sheetDetails = incompleteSheets.map(d => `${d.sheetLabel} (${d.assignedCount}/${d.totalCount})`).join(", ");
        return rejected([AlbumSheetRenderReason.INCOMPLETE_SPREADS], {
            incompleteSheets: Object.freeze(incompleteSheets),
            totalIncomplete: incompleteSheets.length,
            totalMissing,
            message: `Lab Print Batch blocked: ${incompleteSheets.length} incomplete spread(s) with ${totalMissing} empty slot(s). Affected: ${sheetDetails}`
        });
    }

    const sheetRequests = [];
    const skippedSheets = [];

    for (const sheet of sheets) {
        const result = createAlbumSheetRenderRequest({
            projectId,
            album: inspected.album,
            registry,
            sheetId: sheet.id,
            selectedPhotoIds
        });

        if (result.accepted) {
            sheetRequests.push(result.request);
        } else {
            skippedSheets.push({
                sheetId: sheet.id,
                reasonCodes: result.reasonCodes
            });
        }
    }

    if (sheetRequests.length === 0) {
        return rejected([AlbumSheetRenderReason.NO_RENDERABLE_SHEETS]);
    }

    return accepted({
        schemaVersion: ALBUM_BATCH_RENDER_REQUEST_SCHEMA_VERSION,
        projectId,
        batchId: `batch_${Date.now()}`,
        sheetRequests: Object.freeze(sheetRequests),
        totalSheets: sheetRequests.length,
        skippedSheets: Object.freeze(skippedSheets),
        options: Object.freeze({ ...options })
    });
}

/**
 * Validate a detached batch request against current context.
 */
export function validateAlbumBatchRenderRequest(batchRequest, context = {}) {
    if (!batchRequest || batchRequest.schemaVersion !== ALBUM_BATCH_RENDER_REQUEST_SCHEMA_VERSION) {
        return rejected([AlbumSheetRenderReason.INVALID_RENDER_REQUEST]);
    }

    const validatedRequests = [];
    const reasonCodes = [];

    for (const sheetReq of (batchRequest.sheetRequests || [])) {
        const val = validateAlbumSheetRenderRequest(sheetReq, context);
        if (val.accepted) {
            validatedRequests.push(val.request);
        } else {
            reasonCodes.push(...val.reasonCodes);
        }
    }

    if (validatedRequests.length === 0) {
        return rejected(reasonCodes.length ? reasonCodes : [AlbumSheetRenderReason.NO_RENDERABLE_SHEETS]);
    }

    return accepted({
        ...batchRequest,
        sheetRequests: Object.freeze(validatedRequests),
        totalSheets: validatedRequests.length
    });
}

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

    const assignedPhotoIds = Array.isArray(sheet.slots) && sheet.slots.length > 0
        ? sheet.slots.map(s => s.photoId).filter(Boolean)
        : [];

    let photoIdsToUse;
    if (assignedPhotoIds.length > 0) {
        const inspectedAssigned = inspectSelectedPhotoIds(assignedPhotoIds);
        if (!inspectedAssigned.valid) {
            return rejected([inspectedAssigned.reasonCode]);
        }
        photoIdsToUse = inspectedAssigned.photoIds;
    } else {
        const selected = inspectSelectedPhotoIds(selectedPhotoIds);
        if (!selected.valid) {
            return rejected([selected.reasonCode]);
        }
        photoIdsToUse = selected.photoIds;
    }

    return accepted({
        schemaVersion: ALBUM_SHEET_RENDER_REQUEST_SCHEMA_VERSION,
        projectId,
        sheet: Object.freeze({
            id: sheet.id,
            templateId: sheet.templateId,
            label: sheet.label || "",
            slots: Array.isArray(sheet.slots) ? Object.freeze([...sheet.slots]) : Object.freeze([])
        }),
        template: templateSnapshot(resolved, registry),
        selectedPhotoIds: photoIdsToUse
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

function rejected(reasonCodes, details = null) {
    return Object.freeze({
        accepted: false,
        reasonCodes: Object.freeze([...new Set(reasonCodes)]),
        request: null,
        details: details ? Object.freeze({ ...details }) : null,
        message: details?.message || null
    });
}

function freezeRequest(request) {
    if (!request || typeof request !== "object") return request;
    if (Array.isArray(request.sheetRequests)) {
        return Object.freeze({
            ...request,
            sheetRequests: Object.freeze(request.sheetRequests.slice()),
            skippedSheets: Array.isArray(request.skippedSheets)
                ? Object.freeze(request.skippedSheets.slice())
                : Object.freeze([]),
            options: Object.freeze({ ...request.options })
        });
    }
    const value = {
        ...request,
        sheet: request.sheet ? Object.freeze({ ...request.sheet }) : null,
        template: request.template ? Object.freeze({ ...request.template }) : null,
        selectedPhotoIds: Array.isArray(request.selectedPhotoIds)
            ? Object.freeze(request.selectedPhotoIds.slice())
            : Object.freeze([])
    };
    return Object.freeze(value);
}
