const VALID_ROLES = new Set(["TITLE", "CAPTION", "QUOTE"]);

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function freezePreset(preset) {
    return Object.freeze({
        id: preset.id,
        role: preset.role,
        name: preset.name,
        text: preset.text
    });
}

export function normalizeLocalTextPresetCatalog(value) {
    const source = Array.isArray(value) ? value : value?.presets;
    const seen = new Set();
    const presets = (Array.isArray(source) ? source : [])
        .map(candidate => ({
            id: clean(candidate?.id),
            role: clean(candidate?.role).toUpperCase(),
            name: clean(candidate?.name),
            text: clean(candidate?.text)
        }))
        .filter(candidate =>
            candidate.id &&
            !seen.has(candidate.id) &&
            VALID_ROLES.has(candidate.role) &&
            candidate.name &&
            candidate.text &&
            seen.add(candidate.id)
        )
        .map(freezePreset);

    return Object.freeze({
        version: 1,
        presets: Object.freeze(presets)
    });
}

export function saveLocalTextPreset(catalog, candidate) {
    const current = normalizeLocalTextPresetCatalog(catalog);
    const preset = normalizeLocalTextPresetCatalog({ presets: [candidate] }).presets[0];
    if (!preset) {
        return Object.freeze({ accepted: false, reasonCode: "INVALID_PRESET", catalog: current });
    }

    const duplicate = current.presets.find(item =>
        item.id !== preset.id &&
        item.role === preset.role &&
        item.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (duplicate) {
        return Object.freeze({ accepted: false, reasonCode: "DUPLICATE_NAME", catalog: current });
    }

    const existingIndex = current.presets.findIndex(item => item.id === preset.id);
    const presets = [...current.presets];
    if (existingIndex >= 0) presets[existingIndex] = preset;
    else presets.push(preset);

    return Object.freeze({
        accepted: true,
        reasonCode: null,
        catalog: normalizeLocalTextPresetCatalog({ presets })
    });
}

export function deleteLocalTextPreset(catalog, presetId) {
    const current = normalizeLocalTextPresetCatalog(catalog);
    const id = clean(presetId);
    if (!current.presets.some(preset => preset.id === id)) {
        return Object.freeze({ accepted: false, reasonCode: "PRESET_NOT_FOUND", catalog: current });
    }
    return Object.freeze({
        accepted: true,
        reasonCode: null,
        catalog: normalizeLocalTextPresetCatalog({
            presets: current.presets.filter(preset => preset.id !== id)
        })
    });
}

export function localTextPresetsForRole(catalog, role) {
    const normalizedRole = clean(role).toUpperCase();
    return normalizeLocalTextPresetCatalog(catalog).presets.filter(
        preset => preset.role === normalizedRole
    );
}
