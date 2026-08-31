const MAX_TEXT_LENGTH = 2000;
const MAX_FONT_FAMILY_LENGTH = 160;
const MAX_FONT_SIZE = 1000;
const ASSIGNMENT_FIELDS = new Set(["layerId", "role", "text", "preset", "placement"]);
const PRESET_FIELDS = new Set(["fontFamily", "fontSize", "color", "alignment"]);
const ROLES = new Set(["TITLE", "CAPTION", "QUOTE"]);
const ANCHORS = new Set([
    "TOP_LEFT", "TOP_CENTER", "TOP_RIGHT",
    "BOTTOM_LEFT", "BOTTOM_CENTER", "BOTTOM_RIGHT"
]);

export function inspectTypographyAssignmentIntent(assignment) {
    if (!plain(assignment)) return invalid("INVALID_ASSIGNMENT");
    if (Object.keys(assignment).some(field => !ASSIGNMENT_FIELDS.has(field))) {
        return invalid("UNSUPPORTED_ASSIGNMENT_FIELD");
    }
    if (!layerId(assignment.layerId)) return invalid("INVALID_LAYER_ID");
    if (!ROLES.has(assignment.role)) return invalid("UNSUPPORTED_ROLE");
    if (typeof assignment.text !== "string" || !assignment.text.trim() ||
        assignment.text.length > MAX_TEXT_LENGTH) return invalid("INVALID_TEXT");
    const preset = normalizePreset(assignment.preset);
    if (assignment.preset != null && !preset) return invalid("INVALID_PRESET");
    const placement = normalizePlacement(assignment.placement);
    if (assignment.placement != null && !placement) return invalid("INVALID_PLACEMENT");
    return Object.freeze({
        valid: true,
        reasonCode: null,
        assignment: deepFreeze({
            layerId: assignment.layerId,
            role: assignment.role,
            text: assignment.text,
            preset,
            placement
        })
    });
}

export function normalizeTypographyAssignmentIntent(assignment) {
    const inspected = inspectTypographyAssignmentIntent(assignment);
    return inspected.valid ? inspected.assignment : null;
}

export function typographyFailureMessage(code, layer = null) {
    const message = code === "TARGET_NOT_EDITABLE"
        ? "Layer is hidden or locked. Show or unlock it."
        : code === "FONT_UNAVAILABLE"
            ? "Font is not installed. Choose another."
            : "Typography could not be applied safely.";
    return layer == null ? message : `${message} Layer: ${layer}.`;
}

function normalizePreset(preset) {
    if (preset == null) return null;
    if (!plain(preset) || Object.keys(preset).some(field => !PRESET_FIELDS.has(field))) return null;
    if (preset.fontFamily != null && !bounded(preset.fontFamily, MAX_FONT_FAMILY_LENGTH)) return null;
    if (preset.fontSize != null && (!Number.isFinite(preset.fontSize) ||
        preset.fontSize <= 0 || preset.fontSize > MAX_FONT_SIZE)) return null;
    if (preset.alignment != null && !bounded(preset.alignment, 80)) return null;
    const color = normalizeColor(preset.color);
    if (preset.color != null && !color) return null;
    return deepFreeze({
        fontFamily: preset.fontFamily ?? null,
        fontSize: preset.fontSize ?? null,
        color,
        alignment: preset.alignment ?? null
    });
}

function normalizeColor(color) {
    if (color == null) return null;
    if (!plain(color)) return null;
    const channels = [color.red, color.green, color.blue];
    return channels.some(value => !Number.isFinite(value) || value < 0 || value > 255)
        ? null
        : Object.freeze({ red: color.red, green: color.green, blue: color.blue });
}

function normalizePlacement(placement) {
    if (placement == null) return null;
    return plain(placement) && Object.keys(placement).every(field => field === "anchor") &&
        ANCHORS.has(placement.anchor)
        ? Object.freeze({ anchor: placement.anchor })
        : null;
}

function invalid(reasonCode) {
    return Object.freeze({ valid: false, reasonCode, assignment: null });
}

function plain(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function layerId(value) {
    return (Number.isInteger(value) && value >= 0) || bounded(value, 120);
}

function bounded(value, limit) {
    return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}

function deepFreeze(value) {
    return Object.freeze(value);
}
