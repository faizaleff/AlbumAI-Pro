import React, { useEffect, useMemo, useState } from "react";
import UxpDropdown from "./UxpDropdown";
import {
    deleteLocalTextPreset,
    localTextPresetsForRole,
    normalizeLocalTextPresetCatalog,
    saveLocalTextPreset
} from "../typography/LocalTextPresetCatalog";

const ROLE_OPTIONS = Object.freeze([
    Object.freeze({ value: "", label: "Choose role" }),
    Object.freeze({ value: "TITLE", label: "Title" }),
    Object.freeze({ value: "CAPTION", label: "Caption" }),
    Object.freeze({ value: "QUOTE", label: "Quote" })
]);

const PLACEMENT_OPTIONS = Object.freeze([
    Object.freeze({ value: "", label: "Keep position" }),
    Object.freeze({ value: "TOP_LEFT", label: "Top left" }),
    Object.freeze({ value: "TOP_CENTER", label: "Top center" }),
    Object.freeze({ value: "TOP_RIGHT", label: "Top right" }),
    Object.freeze({ value: "BOTTOM_LEFT", label: "Bottom left" }),
    Object.freeze({ value: "BOTTOM_CENTER", label: "Bottom center" }),
    Object.freeze({ value: "BOTTOM_RIGHT", label: "Bottom right" })
]);

const PRESERVE_STYLE_OPTION = Object.freeze({
    value: "",
    label: "Preserve current style",
    preset: null
});

const PRESERVE_FONT_OPTION = Object.freeze({
    value: "",
    label: "Preserve current font",
    preset: null
});

const NO_SUGGESTION_OPTION = Object.freeze({
    value: "",
    label: "No suggestion",
    text: null
});

const LOCAL_TEXT_SUGGESTIONS = Object.freeze({
    TITLE: Object.freeze([
        Object.freeze({ value: "title-our-story", label: "Our Story", text: "Our Story" }),
        Object.freeze({ value: "title-together", label: "Together", text: "Together" }),
        Object.freeze({ value: "title-day-to-remember", label: "A Day to Remember", text: "A Day to Remember" })
    ]),
    CAPTION: Object.freeze([
        Object.freeze({ value: "caption-moment", label: "A moment to remember", text: "A moment to remember" }),
        Object.freeze({ value: "caption-made-with-love", label: "Made with love", text: "Made with love" }),
        Object.freeze({ value: "caption-forever-starts", label: "Forever starts here", text: "Forever starts here" })
    ]),
    QUOTE: Object.freeze([
        Object.freeze({ value: "quote-every-chapter", label: "Every chapter begins with a moment", text: "Every chapter begins with a moment" }),
        Object.freeze({ value: "quote-best-days", label: "The best days are shared", text: "The best days are shared" }),
        Object.freeze({ value: "quote-here-together", label: "Here, together, always", text: "Here, together, always" })
    ])
});

export function createLocalTextSuggestionOptions(role, customCatalog = null) {
    const custom = localTextPresetsForRole(customCatalog, role).map(preset => Object.freeze({
        value: `custom:${preset.id}`,
        label: `Saved: ${preset.name}`,
        text: preset.text
    }));
    return [NO_SUGGESTION_OPTION, ...(LOCAL_TEXT_SUGGESTIONS[role] || []), ...custom];
}

export function applyLocalTextSuggestion(draft, suggestionId, customCatalog = null) {
    const option = createLocalTextSuggestionOptions(draft?.role, customCatalog)
        .find(candidate => candidate.value === suggestionId);
    if (!option?.text) return { ...draft, suggestionId: "" };
    return { ...draft, suggestionId: option.value, text: option.text };
}

const ALIGNMENT_ALIASES = Object.freeze({
    left: "left",
    leftJustified: "left",
    center: "center",
    centered: "center",
    right: "right",
    rightJustified: "right",
    justify: "justify",
    justifyAll: "justify",
    fullyJustified: "justify"
});

export function normalizeTemplateTypographyAlignment(alignment) {
    return typeof alignment === "string" ? ALIGNMENT_ALIASES[alignment] || null : null;
}

function cloneTypographyPreset(preset) {
    if (!preset) return null;
    return {
        ...preset,
        ...(preset.color ? { color: { ...preset.color } } : {})
    };
}

export function mergeTypographyPresets(...presets) {
    const merged = {};
    presets.filter(Boolean).forEach(preset => {
        if (typeof preset.fontFamily === "string" && preset.fontFamily.trim()) {
            merged.fontFamily = preset.fontFamily.trim();
        }
        if (Number.isFinite(preset.fontSize) && preset.fontSize > 0) {
            merged.fontSize = preset.fontSize;
        }
        if (preset.color) merged.color = { ...preset.color };
        if (preset.alignment) merged.alignment = preset.alignment;
    });
    return Object.keys(merged).length ? merged : null;
}

function createTemplateTypographyPreset(style = {}) {
    const preset = {};
    if (typeof style.fontFamily === "string" && style.fontFamily.trim()) {
        preset.fontFamily = style.fontFamily.trim();
    }
    if (Number.isFinite(style.fontSize) && style.fontSize > 0) {
        preset.fontSize = style.fontSize;
    }
    if (style.color && ["red", "green", "blue"].every(channel =>
        Number.isFinite(style.color[channel]) && style.color[channel] >= 0 && style.color[channel] <= 255
    )) {
        preset.color = {
            red: style.color.red,
            green: style.color.green,
            blue: style.color.blue
        };
    }
    const alignment = normalizeTemplateTypographyAlignment(style.alignment);
    if (alignment) preset.alignment = alignment;
    return Object.keys(preset).length ? preset : null;
}

function readTemplateTypographyStyle(layer = {}) {
    const nested = layer.style || {};
    return {
        fontFamily: layer.fontFamily ?? nested.fontFamily,
        fontSize: layer.fontSize ?? nested.fontSize,
        color: layer.color ?? nested.color,
        alignment: layer.alignment ?? nested.alignment
    };
}

export function createTemplateTypographyPresetOptions(textLayers = []) {
    const options = [PRESERVE_STYLE_OPTION];
    textLayers.forEach(layer => {
        const preset = createTemplateTypographyPreset(readTemplateTypographyStyle(layer));
        if (!preset) return;
        options.push(Object.freeze({
            value: String(layer.layerId),
            label: `Style: ${layer.layerName || `Layer ${layer.layerId}`}`,
            preset
        }));
    });
    return options;
}

export function createTemplateTypographyFontOptions(textLayers = []) {
    const options = [PRESERVE_FONT_OPTION];
    const seen = new Set();
    textLayers.forEach(layer => {
        const { fontFamily } = readTemplateTypographyStyle(layer);
        const normalized = typeof fontFamily === "string" ? fontFamily.trim() : "";
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        options.push(Object.freeze({
            value: normalized,
            label: `Font: ${normalized}`,
            preset: Object.freeze({ fontFamily: normalized })
        }));
    });
    return options;
}

export function createTemplateTypographyStyleOptions(textLayers = []) {
    const options = [PRESERVE_STYLE_OPTION];
    textLayers.forEach(layer => {
        const preset = createTemplateTypographyPreset(readTemplateTypographyStyle(layer));
        if (!preset) return;
        const { fontFamily: _fontFamily, ...stylePreset } = preset;
        if (!Object.keys(stylePreset).length) return;
        options.push(Object.freeze({
            value: String(layer.layerId),
            label: `Style: ${layer.layerName || `Layer ${layer.layerId}`}`,
            preset: Object.freeze(stylePreset)
        }));
    });
    return options;
}

export function createManualTypographyDrafts(textLayers = []) {
    return textLayers.map(layer => ({
        layerId: layer.layerId,
        layerName: layer.layerName || `Layer ${layer.layerId}`,
        role: "",
        text: typeof layer.textContent === "string" ? layer.textContent : "",
        presetId: "",
        preset: null,
        fontPresetId: "",
        fontPreset: null,
        stylePresetId: "",
        stylePreset: null,
        suggestionId: "",
        placementAnchor: "",
        editable: layer.visible !== false && layer.locked !== true
    }));
}

export function buildManualTypographyAssignments(drafts = []) {
    return drafts
        .filter(draft => draft.editable && draft.role && draft.text.trim())
        .map(draft => ({
            layerId: draft.layerId,
            role: draft.role,
            text: draft.text,
            preset: mergeTypographyPresets(
                draft.preset,
                draft.fontPreset,
                draft.stylePreset
            ),
            ...(draft.placementAnchor ? {
                placement: { anchor: draft.placementAnchor }
            } : {})
        }));
}

export function applyTypographyResultToDocument(document, drafts, result) {
    if (!document?.textLayers || result?.status !== "SUCCESS") return document;
    const completed = new Set(result.completedLayerIds || []);
    const draftById = new Map(drafts.map(draft => [draft.layerId, draft]));
    return {
        ...document,
        textLayers: document.textLayers.map(layer => {
            if (!completed.has(layer.layerId)) return layer;
            const draft = draftById.get(layer.layerId);
            const preset = mergeTypographyPresets(
                draft?.preset,
                draft?.fontPreset,
                draft?.stylePreset
            );
            return {
                ...layer,
                textContent: draft?.text,
                ...(preset ? cloneTypographyPreset(preset) : {})
            };
        })
    };
}

export default function ManualTypographyPanel({
    document,
    applyTypography,
    onApplied,
    onAssignmentsApplied,
    customTextPresets = null,
    saveCustomTextPresets = null
}) {
    const [drafts, setDrafts] = useState(() =>
        createManualTypographyDrafts(document?.textLayers)
    );
    const [busy, setBusy] = useState(false);
    const [presetBusy, setPresetBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [presetMessage, setPresetMessage] = useState("");
    const [customCatalog, setCustomCatalog] = useState(() =>
        normalizeLocalTextPresetCatalog(customTextPresets)
    );
    const [newPreset, setNewPreset] = useState({ role: "", name: "", text: "" });
    const [presetEdits, setPresetEdits] = useState({});
    const assignments = useMemo(
        () => buildManualTypographyAssignments(drafts),
        [drafts]
    );
    const fontOptions = useMemo(
        () => createTemplateTypographyFontOptions(document?.textLayers),
        [document?.textLayers]
    );
    const styleOptions = useMemo(
        () => createTemplateTypographyStyleOptions(document?.textLayers),
        [document?.textLayers]
    );

    useEffect(() => {
        setDrafts(createManualTypographyDrafts(document?.textLayers));
        setMessage("");
    }, [document?.document?.id]);

    useEffect(() => {
        const normalized = normalizeLocalTextPresetCatalog(customTextPresets);
        setCustomCatalog(normalized);
        setPresetEdits(Object.fromEntries(normalized.presets.map(preset => [
            preset.id,
            { name: preset.name, text: preset.text }
        ])));
        setPresetMessage("");
    }, [customTextPresets]);

    if (!document?.textLayers?.length) return null;

    const update = (layerId, field, value) => setDrafts(current => current.map(
        draft => draft.layerId === layerId ? { ...draft, [field]: value } : draft
    ));

    const updateRole = (layerId, role) => setDrafts(current => current.map(
        draft => draft.layerId === layerId
            ? { ...draft, role, suggestionId: "" }
            : draft
    ));

    const updateSuggestion = (layerId, suggestionId) => setDrafts(current => current.map(
        draft => draft.layerId === layerId
            ? applyLocalTextSuggestion(draft, suggestionId, customCatalog)
            : draft
    ));

    const persistCustomCatalog = async (nextCatalog, successMessage) => {
        if (typeof saveCustomTextPresets !== "function" || presetBusy) return;
        setPresetBusy(true);
        setPresetMessage("");
        try {
            const saved = normalizeLocalTextPresetCatalog(
                await saveCustomTextPresets(nextCatalog)
            );
            setCustomCatalog(saved);
            setPresetEdits(Object.fromEntries(saved.presets.map(preset => [
                preset.id,
                { name: preset.name, text: preset.text }
            ])));
            setPresetMessage(successMessage);
        } catch (error) {
            setPresetMessage(`Preset not saved: ${error?.message || "UNKNOWN"}`);
        } finally {
            setPresetBusy(false);
        }
    };

    const createCustomPreset = async () => {
        const result = saveLocalTextPreset(customCatalog, {
            id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            ...newPreset
        });
        if (!result.accepted) {
            setPresetMessage(`Preset not saved: ${result.reasonCode}`);
            return;
        }
        await persistCustomCatalog(result.catalog, "Custom text preset saved.");
        setNewPreset({ role: "", name: "", text: "" });
    };

    const updateCustomPreset = async preset => {
        const edit = presetEdits[preset.id] || {};
        const result = saveLocalTextPreset(customCatalog, { ...preset, ...edit });
        if (!result.accepted) {
            setPresetMessage(`Preset not saved: ${result.reasonCode}`);
            return;
        }
        await persistCustomCatalog(result.catalog, "Custom text preset updated.");
    };

    const removeCustomPreset = async presetId => {
        const result = deleteLocalTextPreset(customCatalog, presetId);
        if (!result.accepted) return;
        setDrafts(current => current.map(draft =>
            draft.suggestionId === `custom:${presetId}`
                ? { ...draft, suggestionId: "" }
                : draft
        ));
        await persistCustomCatalog(result.catalog, "Custom text preset deleted.");
    };

    const updatePreset = (layerId, presetId, idField, presetField, options) => {
        const option = options.find(candidate => candidate.value === presetId);
        setDrafts(current => current.map(draft => draft.layerId === layerId
            ? {
                ...draft,
                [idField]: presetId,
                [presetField]: cloneTypographyPreset(option?.preset)
            }
            : draft));
    };

    const apply = async () => {
        if (!assignments.length || busy || typeof applyTypography !== "function") return;
        setBusy(true);
        setMessage("");
        try {
            const result = await applyTypography({
                expectedDocumentId: document.document.id,
                assignments
            });
            if (result?.status !== "SUCCESS") {
                setMessage(`Typography not applied: ${result?.reasonCode || "UNKNOWN"}`);
                return;
            }
            setMessage(`Applied ${result.completedLayerIds.length} text layer(s). Cmd+Z to undo.`);
            onApplied?.(drafts, result);
            await onAssignmentsApplied?.(assignments, result);
        } catch (error) {
            setMessage(`Typography not applied: ${error?.message || "UNKNOWN"}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section style={{ marginTop: 12, padding: 10, border: "1px solid #454545", borderRadius: 5 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Typography</div>
            <div style={{ color: "#aaa", marginBottom: 8 }}>
                Choose a role, optionally use an offline local text suggestion or a project-saved preset, edit the text, optionally reuse a style already present in this template, independently reuse a font and style already present in this template, and place it explicitly.
            </div>
            {drafts.map(draft => (
                <div key={draft.layerId} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <UxpDropdown
                        value={draft.role}
                        options={ROLE_OPTIONS}
                        onValueChange={value => updateRole(draft.layerId, value)}
                        ariaLabel={`Role for ${draft.layerName}`}
                        title={`Role for ${draft.layerName}`}
                        disabled={!draft.editable || busy}
                    />
                    <UxpDropdown
                        value={draft.suggestionId}
                        options={createLocalTextSuggestionOptions(draft.role, customCatalog)}
                        onValueChange={value => updateSuggestion(draft.layerId, value)}
                        ariaLabel={`Suggestion for ${draft.layerName}`}
                        title={`Suggestion for ${draft.layerName}`}
                        disabled={!draft.editable || busy || !draft.role}
                    />
                    <UxpDropdown
                        value={draft.fontPresetId}
                        options={fontOptions}
                        onValueChange={value => updatePreset(
                            draft.layerId,
                            value,
                            "fontPresetId",
                            "fontPreset",
                            fontOptions
                        )}
                        ariaLabel={`Font for ${draft.layerName}`}
                        title={`Font for ${draft.layerName}`}
                        disabled={!draft.editable || busy}
                    />
                    <UxpDropdown
                        value={draft.stylePresetId}
                        options={styleOptions}
                        onValueChange={value => updatePreset(
                            draft.layerId,
                            value,
                            "stylePresetId",
                            "stylePreset",
                            styleOptions
                        )}
                        ariaLabel={`Style for ${draft.layerName}`}
                        title={`Style for ${draft.layerName}`}
                        disabled={!draft.editable || busy}
                    />
                    <UxpDropdown
                        value={draft.placementAnchor}
                        options={PLACEMENT_OPTIONS}
                        onValueChange={value => update(draft.layerId, "placementAnchor", value)}
                        ariaLabel={`Position for ${draft.layerName}`}
                        title={`Position for ${draft.layerName}`}
                        disabled={!draft.editable || busy}
                    />
                    <input
                        style={{ flex: "1 1 220px", minWidth: 0 }}
                        value={draft.text}
                        onChange={event => update(draft.layerId, "text", event.target.value)}
                        aria-label={`Text for ${draft.layerName}`}
                        title={draft.layerName}
                        disabled={!draft.editable || busy}
                    />
                </div>
            ))}
            <button onClick={apply} disabled={busy || assignments.length === 0}>
                {busy ? "Applying…" : `Apply Typography (${assignments.length})`}
            </button>
            {!!message && <div style={{ marginTop: 7 }}>{message}</div>}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #454545" }}>
                <div style={{ fontWeight: 600, marginBottom: 7 }}>Custom text presets</div>
                <div style={{ color: "#aaa", marginBottom: 8 }}>
                    Saved only in this project. No network or AI is used.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <UxpDropdown
                        value={newPreset.role}
                        options={ROLE_OPTIONS}
                        onValueChange={role => setNewPreset(current => ({ ...current, role }))}
                        ariaLabel="Role for new custom text preset"
                        title="Role for new custom text preset"
                        disabled={presetBusy}
                    />
                    <input
                        value={newPreset.name}
                        onChange={event => {
                            const value = event.target.value;
                            setNewPreset(current => ({ ...current, name: value }));
                        }}
                        placeholder="Preset name"
                        aria-label="Custom text preset name"
                        disabled={presetBusy}
                    />
                    <input
                        style={{ flex: "1 1 220px", minWidth: 0 }}
                        value={newPreset.text}
                        onChange={event => {
                            const value = event.target.value;
                            setNewPreset(current => ({ ...current, text: value }));
                        }}
                        placeholder="Preset text"
                        aria-label="Custom text preset text"
                        disabled={presetBusy}
                    />
                    <button
                        onClick={createCustomPreset}
                        disabled={presetBusy || !newPreset.role || !newPreset.name.trim() || !newPreset.text.trim()}
                    >
                        Save preset
                    </button>
                </div>
                {customCatalog.presets.map(preset => (
                    <div key={preset.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                        <span style={{ minWidth: 62 }}>{preset.role.charAt(0) + preset.role.slice(1).toLowerCase()}</span>
                        <input
                            value={presetEdits[preset.id]?.name ?? preset.name}
                            onChange={event => {
                                const value = event.target.value;
                                setPresetEdits(current => ({
                                    ...current,
                                    [preset.id]: { ...(current[preset.id] || preset), name: value }
                                }));
                            }}
                            aria-label={`Name for ${preset.name}`}
                            disabled={presetBusy}
                        />
                        <input
                            style={{ flex: "1 1 220px", minWidth: 0 }}
                            value={presetEdits[preset.id]?.text ?? preset.text}
                            onChange={event => {
                                const value = event.target.value;
                                setPresetEdits(current => ({
                                    ...current,
                                    [preset.id]: { ...(current[preset.id] || preset), text: value }
                                }));
                            }}
                            aria-label={`Text for ${preset.name}`}
                            disabled={presetBusy}
                        />
                        <button onClick={() => updateCustomPreset(preset)} disabled={presetBusy}>Update</button>
                        <button onClick={() => removeCustomPreset(preset.id)} disabled={presetBusy}>Delete</button>
                    </div>
                ))}
                {!!presetMessage && <div style={{ marginTop: 7 }}>{presetMessage}</div>}
            </div>
        </section>
    );
}
