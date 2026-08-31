import { inspectTypographyAssignmentIntent } from "./TypographyAssignmentIntent";

export const TYPOGRAPHY_SCHEMA_VERSION = 1;

export { default as PhotoshopTypographyAdapter } from "./PhotoshopTypographyAdapter";

export const TypographyState = Object.freeze({
    READY: "READY",
    BLOCKED: "BLOCKED"
});

export const TypographyRole = Object.freeze({
    TITLE: "TITLE",
    CAPTION: "CAPTION",
    QUOTE: "QUOTE"
});

export const TypographyPlacementAnchor = Object.freeze({
    TOP_LEFT: "TOP_LEFT",
    TOP_CENTER: "TOP_CENTER",
    TOP_RIGHT: "TOP_RIGHT",
    BOTTOM_LEFT: "BOTTOM_LEFT",
    BOTTOM_CENTER: "BOTTOM_CENTER",
    BOTTOM_RIGHT: "BOTTOM_RIGHT"
});

export const TypographyReason = Object.freeze({
    INVALID_TEXT_LAYERS: "INVALID_TEXT_LAYERS",
    TOO_MANY_TEXT_LAYERS: "TOO_MANY_TEXT_LAYERS",
    INVALID_TEXT_LAYER: "INVALID_TEXT_LAYER",
    INVALID_LAYER_ID: "INVALID_LAYER_ID",
    DUPLICATE_LAYER_ID: "DUPLICATE_LAYER_ID",
    UNSUPPORTED_TEXT_LAYER_FIELD: "UNSUPPORTED_TEXT_LAYER_FIELD",
    INVALID_TEMPLATE_ID: "INVALID_TEMPLATE_ID",
    INVALID_INVENTORY: "INVALID_INVENTORY",
    INVENTORY_BLOCKED: "INVENTORY_BLOCKED",
    INVALID_ASSIGNMENTS: "INVALID_ASSIGNMENTS",
    TOO_MANY_ASSIGNMENTS: "TOO_MANY_ASSIGNMENTS",
    INVALID_ASSIGNMENT: "INVALID_ASSIGNMENT",
    UNSUPPORTED_ASSIGNMENT_FIELD: "UNSUPPORTED_ASSIGNMENT_FIELD",
    TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
    TARGET_NOT_EDITABLE: "TARGET_NOT_EDITABLE",
    DUPLICATE_TARGET: "DUPLICATE_TARGET",
    UNSUPPORTED_ROLE: "UNSUPPORTED_ROLE",
    INVALID_TEXT: "INVALID_TEXT",
    INVALID_PRESET: "INVALID_PRESET",
    INVALID_PLACEMENT: "INVALID_PLACEMENT"
});

const MAX_TEXT_LAYERS = 500;
const MAX_ASSIGNMENTS = 500;
const MAX_TEMPLATE_ID_LENGTH = 160;
const TEXT_LAYER_FIELDS = new Set([
    "documentId",
    "layerId",
    "parentGroupId",
    "parentGroupName",
    "layerName",
    "layerType",
    "textContent",
    "fontFamily",
    "fontSize",
    "color",
    "alignment",
    "visible",
    "locked",
    "bounds"
]);

/**
 * Convert TemplateLayerTreeReader text descriptors into a detached inventory.
 * Layer names are display data only; roles are never inferred from them.
 */
export function createTypographyInventory(textLayers) {

    if (!Array.isArray(textLayers)) {
        return blockedInventory(TypographyReason.INVALID_TEXT_LAYERS);
    }

    if (textLayers.length > MAX_TEXT_LAYERS) {
        return blockedInventory(TypographyReason.TOO_MANY_TEXT_LAYERS);
    }

    const layerIds = new Set();
    const slots = [];

    for (const layer of textLayers) {
        const inspected = inspectTextLayer(layer, layerIds);

        if (!inspected.valid) {
            return blockedInventory(inspected.reasonCode);
        }

        layerIds.add(inspected.slot.layerId);
        slots.push(inspected.slot);
    }

    return freeze({
        schemaVersion: TYPOGRAPHY_SCHEMA_VERSION,
        state: TypographyState.READY,
        reasonCodes: [],
        slots
    });

}

/**
 * Build a deterministic, host-object-free plan for a future Photoshop adapter.
 * This function validates intent only; it never mutates a Photoshop document.
 */
export function createTypographyPlan({ templateId, inventory, assignments } = {}) {

    if (!isBoundedString(templateId, MAX_TEMPLATE_ID_LENGTH)) {
        return blockedPlan(templateId, TypographyReason.INVALID_TEMPLATE_ID);
    }

    if (!isTypographyInventory(inventory)) {
        return blockedPlan(templateId, TypographyReason.INVALID_INVENTORY);
    }

    if (inventory.state !== TypographyState.READY) {
        return blockedPlan(templateId, TypographyReason.INVENTORY_BLOCKED);
    }

    if (!Array.isArray(assignments)) {
        return blockedPlan(templateId, TypographyReason.INVALID_ASSIGNMENTS);
    }

    if (assignments.length > MAX_ASSIGNMENTS) {
        return blockedPlan(templateId, TypographyReason.TOO_MANY_ASSIGNMENTS);
    }

    const slots = new Map(inventory.slots.map(slot => [slot.layerId, slot]));
    const targets = new Set();
    const steps = [];

    for (const assignment of assignments) {
        const inspected = inspectAssignment(assignment, slots, targets);

        if (!inspected.valid) {
            return blockedPlan(templateId, inspected.reasonCode);
        }

        targets.add(inspected.step.layerId);
        steps.push(inspected.step);
    }

    return freeze({
        schemaVersion: TYPOGRAPHY_SCHEMA_VERSION,
        templateId,
        state: TypographyState.READY,
        reasonCodes: [],
        steps
    });

}

function inspectTextLayer(layer, layerIds) {

    if (!isPlainObject(layer)) {
        return invalid(TypographyReason.INVALID_TEXT_LAYER);
    }

    if (Object.keys(layer).some(field => !TEXT_LAYER_FIELDS.has(field))) {
        return invalid(TypographyReason.UNSUPPORTED_TEXT_LAYER_FIELD);
    }

    if (!isLayerId(layer.layerId)) {
        return invalid(TypographyReason.INVALID_LAYER_ID);
    }

    if (layerIds.has(layer.layerId)) {
        return invalid(TypographyReason.DUPLICATE_LAYER_ID);
    }

    if (layer.layerType != null && layer.layerType !== "textLayer") {
        return invalid(TypographyReason.INVALID_TEXT_LAYER);
    }

    const style = normalizeStyle(layer);
    const bounds = normalizeBounds(layer.bounds);

    return {
        valid: true,
        slot: freeze({
            layerId: layer.layerId,
            layerName: typeof layer.layerName === "string" ? layer.layerName : "",
            editable: layer.visible !== false && layer.locked !== true,
            currentText: typeof layer.textContent === "string" ? layer.textContent : "",
            style,
            bounds
        })
    };

}

function inspectAssignment(assignment, slots, targets) {

    if (!isLayerId(assignment.layerId)) {
        return invalid(TypographyReason.INVALID_LAYER_ID);
    }

    if (targets.has(assignment.layerId)) {
        return invalid(TypographyReason.DUPLICATE_TARGET);
    }

    const slot = slots.get(assignment.layerId);

    if (!slot) {
        return invalid(TypographyReason.TARGET_NOT_FOUND);
    }

    if (!slot.editable) {
        return invalid(TypographyReason.TARGET_NOT_EDITABLE);
    }

    const inspected = inspectTypographyAssignmentIntent(assignment);
    return inspected.valid
        ? { valid: true, step: inspected.assignment }
        : invalid(inspected.reasonCode);

}

function normalizeStyle(layer) {

    return freeze({
        fontFamily: typeof layer.fontFamily === "string" ? layer.fontFamily : null,
        fontSize: finiteNumber(layer.fontSize),
        color: normalizeColor(layer.color),
        alignment: typeof layer.alignment === "string" ? layer.alignment : null
    });

}

function normalizeColor(color) {

    if (color == null) {
        return null;
    }

    if (!isPlainObject(color)) {
        return null;
    }

    const channels = [color.red, color.green, color.blue];

    if (channels.some(channel =>
        !Number.isFinite(channel) || channel < 0 || channel > 255
    )) {
        return null;
    }

    return freeze({ red: color.red, green: color.green, blue: color.blue });

}

function normalizeBounds(bounds) {

    if (bounds == null || !isPlainObject(bounds)) {
        return null;
    }

    const normalized = {
        left: finiteNumber(bounds.left),
        top: finiteNumber(bounds.top),
        right: finiteNumber(bounds.right),
        bottom: finiteNumber(bounds.bottom)
    };

    return Object.values(normalized).every(value => value != null)
        ? freeze(normalized)
        : null;

}

function isTypographyInventory(inventory) {

    return isPlainObject(inventory) &&
        inventory.schemaVersion === TYPOGRAPHY_SCHEMA_VERSION &&
        Object.values(TypographyState).includes(inventory.state) &&
        Array.isArray(inventory.reasonCodes) &&
        Array.isArray(inventory.slots);

}

function blockedInventory(reasonCode) {

    return freeze({
        schemaVersion: TYPOGRAPHY_SCHEMA_VERSION,
        state: TypographyState.BLOCKED,
        reasonCodes: [reasonCode],
        slots: []
    });

}

function blockedPlan(templateId, reasonCode) {

    return freeze({
        schemaVersion: TYPOGRAPHY_SCHEMA_VERSION,
        templateId: typeof templateId === "string" ? templateId : null,
        state: TypographyState.BLOCKED,
        reasonCodes: [reasonCode],
        steps: []
    });

}

function invalid(reasonCode) {

    return { valid: false, reasonCode };

}

function isPlainObject(value) {

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;

}

function isLayerId(value) {

    return (Number.isInteger(value) && value >= 0) ||
        isBoundedString(value, 160);

}

function isBoundedString(value, maximum) {

    return typeof value === "string" &&
        value.trim().length > 0 && value.length <= maximum;

}

function finiteNumber(value) {

    return Number.isFinite(value) ? value : null;

}

function freeze(value) {

    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
        return value;
    }

    Object.values(value).forEach(item => freeze(item));

    return Object.freeze(value);

}
