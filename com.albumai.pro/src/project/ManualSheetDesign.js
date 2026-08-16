export const MANUAL_SHEET_DESIGN_SCHEMA_VERSION = 1;

export const ManualSheetDesignReason = Object.freeze({
    MISSING_DESIGN: "MISSING_DESIGN",
    INVALID_DESIGN: "INVALID_DESIGN",
    UNSUPPORTED_SCHEMA: "UNSUPPORTED_SCHEMA",
    INVALID_ASSIGNMENTS: "INVALID_ASSIGNMENTS",
    TOO_MANY_ASSIGNMENTS: "TOO_MANY_ASSIGNMENTS",
    INVALID_ASSIGNMENT: "INVALID_ASSIGNMENT",
    DUPLICATE_SLOT: "DUPLICATE_SLOT",
    INVALID_SLOT: "INVALID_SLOT",
    INVALID_PHOTO_KEY: "INVALID_PHOTO_KEY",
    INVALID_CROP_FOCUS: "INVALID_CROP_FOCUS"
});

export const ManualSheetDesignIntent = Object.freeze({
    ASSIGN_PHOTO: "ASSIGN_PHOTO",
    CLEAR_SLOT: "CLEAR_SLOT",
    SWAP_SLOTS: "SWAP_SLOTS",
    SET_CROP_FOCUS: "SET_CROP_FOCUS"
});

export const ManualSheetDesignMutationReason = Object.freeze({
    INVALID_MUTATION: "INVALID_MUTATION",
    UNSUPPORTED_MUTATION: "UNSUPPORTED_MUTATION",
    SLOT_NOT_AVAILABLE: "SLOT_NOT_AVAILABLE",
    PHOTO_NOT_AVAILABLE: "PHOTO_NOT_AVAILABLE",
    ASSIGNMENT_NOT_FOUND: "ASSIGNMENT_NOT_FOUND",
    INVALID_CROP_FOCUS: "INVALID_CROP_FOCUS",
    NO_CHANGE: "NO_CHANGE"
});

const MAX_ASSIGNMENTS = 100;
const PHOTO_KEY = /^p1-[0-9a-f]{16}$/;
const DEFAULT_CROP_FOCUS = Object.freeze({ x: 0.5, y: 0.5 });
const DESIGN_FIELDS = new Set(["schemaVersion", "assignments"]);
const ASSIGNMENT_FIELDS = new Set(["slotLayerId", "photoKey", "cropFocus"]);

export function createEmptyManualSheetDesign() {
    return freezeDesign({
        schemaVersion: MANUAL_SHEET_DESIGN_SCHEMA_VERSION,
        assignments: []
    });
}

export function inspectManualSheetDesign(design) {
    if (design == null) return invalid(ManualSheetDesignReason.MISSING_DESIGN);
    if (!isObject(design)) return invalid(ManualSheetDesignReason.INVALID_DESIGN);
    if (design.schemaVersion !== MANUAL_SHEET_DESIGN_SCHEMA_VERSION) {
        return invalid(ManualSheetDesignReason.UNSUPPORTED_SCHEMA);
    }
    if (Object.keys(design).some(field => !DESIGN_FIELDS.has(field))) {
        return invalid(ManualSheetDesignReason.INVALID_DESIGN);
    }
    if (!Array.isArray(design.assignments)) {
        return invalid(ManualSheetDesignReason.INVALID_ASSIGNMENTS);
    }
    if (design.assignments.length > MAX_ASSIGNMENTS) {
        return invalid(ManualSheetDesignReason.TOO_MANY_ASSIGNMENTS);
    }

    const slots = new Set();
    const assignments = [];
    for (const value of design.assignments) {
        const inspected = inspectAssignment(value, slots);
        if (!inspected.valid) return inspected;
        slots.add(inspected.assignment.slotLayerId);
        assignments.push(inspected.assignment);
    }

    assignments.sort((left, right) => left.slotLayerId - right.slotLayerId);
    return Object.freeze({
        valid: true,
        reasonCodes: Object.freeze([]),
        design: freezeDesign({
            schemaVersion: MANUAL_SHEET_DESIGN_SCHEMA_VERSION,
            assignments
        })
    });
}

/**
 * Apply one detached manual-designer command. Context contains only current,
 * bounded slot IDs and opaque photo keys; Photos and Photoshop objects never
 * cross this persistence boundary.
 */
export function applyManualSheetDesignMutation(design, mutation, context = {}) {
    const inspected = inspectManualSheetDesign(design);
    if (!inspected.valid) return rejected(inspected.reasonCodes, design);
    if (!isObject(mutation) || typeof mutation.intent !== "string") {
        return rejected([ManualSheetDesignMutationReason.INVALID_MUTATION], inspected.design);
    }

    const slots = availableSlots(context.slotLayerIds);
    const photos = availablePhotos(context.photoKeys);
    const assignments = inspected.design.assignments.map(assignment => ({
        ...assignment,
        cropFocus: { ...assignment.cropFocus }
    }));

    switch (mutation.intent) {
        case ManualSheetDesignIntent.ASSIGN_PHOTO:
            return assignPhoto(assignments, mutation, slots, photos);

        case ManualSheetDesignIntent.CLEAR_SLOT:
            return clearSlot(assignments, mutation, slots);

        case ManualSheetDesignIntent.SWAP_SLOTS:
            return swapSlots(assignments, mutation, slots);

        case ManualSheetDesignIntent.SET_CROP_FOCUS:
            return setCropFocus(assignments, mutation, slots);

        default:
            return rejected([
                ManualSheetDesignMutationReason.UNSUPPORTED_MUTATION
            ], inspected.design);
    }
}

function assignPhoto(assignments, mutation, slots, photos) {
    if (!slots.has(mutation.slotLayerId)) {
        return rejected([ManualSheetDesignMutationReason.SLOT_NOT_AVAILABLE], designOf(assignments));
    }
    if (!photos.has(mutation.photoKey)) {
        return rejected([ManualSheetDesignMutationReason.PHOTO_NOT_AVAILABLE], designOf(assignments));
    }

    const index = assignments.findIndex(item => item.slotLayerId === mutation.slotLayerId);
    if (index >= 0 && assignments[index].photoKey === mutation.photoKey) {
        return unchanged(designOf(assignments));
    }

    const next = {
        slotLayerId: mutation.slotLayerId,
        photoKey: mutation.photoKey,
        cropFocus: { ...DEFAULT_CROP_FOCUS }
    };
    if (index >= 0) assignments[index] = next;
    else assignments.push(next);
    return accepted(designOf(assignments));
}

function clearSlot(assignments, mutation, slots) {
    if (!slots.has(mutation.slotLayerId)) {
        return rejected([ManualSheetDesignMutationReason.SLOT_NOT_AVAILABLE], designOf(assignments));
    }
    const next = assignments.filter(item => item.slotLayerId !== mutation.slotLayerId);
    return next.length === assignments.length
        ? unchanged(designOf(assignments))
        : accepted(designOf(next));
}

function swapSlots(assignments, mutation, slots) {
    const left = mutation.slotLayerId;
    const right = mutation.targetSlotLayerId;
    if (!slots.has(left) || !slots.has(right)) {
        return rejected([ManualSheetDesignMutationReason.SLOT_NOT_AVAILABLE], designOf(assignments));
    }
    if (left === right) return unchanged(designOf(assignments));

    const leftIndex = assignments.findIndex(item => item.slotLayerId === left);
    const rightIndex = assignments.findIndex(item => item.slotLayerId === right);
    if (leftIndex < 0 && rightIndex < 0) return unchanged(designOf(assignments));

    if (leftIndex >= 0 && rightIndex >= 0) {
        const leftAssignment = assignments[leftIndex];
        const rightAssignment = assignments[rightIndex];
        assignments[leftIndex] = { ...rightAssignment, slotLayerId: left };
        assignments[rightIndex] = { ...leftAssignment, slotLayerId: right };
    } else {
        const sourceIndex = leftIndex >= 0 ? leftIndex : rightIndex;
        const target = leftIndex >= 0 ? right : left;
        assignments[sourceIndex] = { ...assignments[sourceIndex], slotLayerId: target };
    }
    return accepted(designOf(assignments));
}

function setCropFocus(assignments, mutation, slots) {
    if (!slots.has(mutation.slotLayerId)) {
        return rejected([ManualSheetDesignMutationReason.SLOT_NOT_AVAILABLE], designOf(assignments));
    }
    const index = assignments.findIndex(item => item.slotLayerId === mutation.slotLayerId);
    if (index < 0) {
        return rejected([ManualSheetDesignMutationReason.ASSIGNMENT_NOT_FOUND], designOf(assignments));
    }
    const focus = normalizeCropFocus(mutation.cropFocus);
    if (!focus) {
        return rejected([ManualSheetDesignMutationReason.INVALID_CROP_FOCUS], designOf(assignments));
    }
    if (sameFocus(assignments[index].cropFocus, focus)) {
        return unchanged(designOf(assignments));
    }
    assignments[index] = { ...assignments[index], cropFocus: focus };
    return accepted(designOf(assignments));
}

function inspectAssignment(value, slots) {
    if (!isObject(value) || Object.keys(value).some(field => !ASSIGNMENT_FIELDS.has(field))) {
        return invalid(ManualSheetDesignReason.INVALID_ASSIGNMENT);
    }
    if (!isSlotLayerId(value.slotLayerId)) {
        return invalid(ManualSheetDesignReason.INVALID_SLOT);
    }
    if (slots.has(value.slotLayerId)) {
        return invalid(ManualSheetDesignReason.DUPLICATE_SLOT);
    }
    if (!PHOTO_KEY.test(value.photoKey || "")) {
        return invalid(ManualSheetDesignReason.INVALID_PHOTO_KEY);
    }
    const cropFocus = normalizeCropFocus(value.cropFocus);
    if (!cropFocus) return invalid(ManualSheetDesignReason.INVALID_CROP_FOCUS);
    return Object.freeze({
        valid: true,
        reasonCodes: Object.freeze([]),
        assignment: Object.freeze({
            slotLayerId: value.slotLayerId,
            photoKey: value.photoKey,
            cropFocus
        })
    });
}

function designOf(assignments) {
    return freezeDesign({
        schemaVersion: MANUAL_SHEET_DESIGN_SCHEMA_VERSION,
        assignments: assignments
            .map(item => ({ ...item, cropFocus: { ...item.cropFocus } }))
            .sort((left, right) => left.slotLayerId - right.slotLayerId)
    });
}

function availableSlots(value) {
    return new Set((Array.isArray(value) ? value : []).filter(isSlotLayerId));
}

function availablePhotos(value) {
    return new Set((Array.isArray(value) ? value : []).filter(key => PHOTO_KEY.test(key || "")));
}

function isSlotLayerId(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function normalizeCropFocus(value) {
    if (!isObject(value)) return null;
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        return null;
    }
    return Object.freeze({
        x: Math.round(x * 1000000) / 1000000,
        y: Math.round(y * 1000000) / 1000000
    });
}

function sameFocus(left, right) {
    return left?.x === right?.x && left?.y === right?.y;
}

function freezeDesign(design) {
    return Object.freeze({
        schemaVersion: design.schemaVersion,
        assignments: Object.freeze(design.assignments.map(assignment => Object.freeze({
            slotLayerId: assignment.slotLayerId,
            photoKey: assignment.photoKey,
            cropFocus: Object.freeze({ ...assignment.cropFocus })
        })))
    });
}

function accepted(design) {
    return Object.freeze({
        accepted: true,
        changed: true,
        reasonCodes: Object.freeze([]),
        design
    });
}

function unchanged(design) {
    return Object.freeze({
        accepted: true,
        changed: false,
        reasonCodes: Object.freeze([ManualSheetDesignMutationReason.NO_CHANGE]),
        design
    });
}

function rejected(reasonCodes, design) {
    return Object.freeze({
        accepted: false,
        changed: false,
        reasonCodes: Object.freeze([...reasonCodes]),
        design
    });
}

function invalid(reason) {
    return Object.freeze({
        valid: false,
        reasonCodes: Object.freeze([reason]),
        design: null
    });
}

function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}
