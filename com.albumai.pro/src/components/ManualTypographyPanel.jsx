import React, { useEffect, useMemo, useState } from "react";
import UxpDropdown from "./UxpDropdown";

const ROLE_OPTIONS = Object.freeze([
    Object.freeze({ value: "", label: "Choose role" }),
    Object.freeze({ value: "TITLE", label: "Title" }),
    Object.freeze({ value: "CAPTION", label: "Caption" }),
    Object.freeze({ value: "QUOTE", label: "Quote" })
]);

const PRESERVE_STYLE_OPTION = Object.freeze({
    value: "",
    label: "Preserve current style",
    preset: null
});

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

export function createManualTypographyDrafts(textLayers = []) {
    return textLayers.map(layer => ({
        layerId: layer.layerId,
        layerName: layer.layerName || `Layer ${layer.layerId}`,
        role: "",
        text: typeof layer.textContent === "string" ? layer.textContent : "",
        presetId: "",
        preset: null,
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
            preset: cloneTypographyPreset(draft.preset)
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
            return {
                ...layer,
                textContent: draft?.text,
                ...(draft?.preset ? cloneTypographyPreset(draft.preset) : {})
            };
        })
    };
}

export default function ManualTypographyPanel({ document, applyTypography, onApplied }) {
    const [drafts, setDrafts] = useState(() =>
        createManualTypographyDrafts(document?.textLayers)
    );
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const assignments = useMemo(
        () => buildManualTypographyAssignments(drafts),
        [drafts]
    );
    const presetOptions = useMemo(
        () => createTemplateTypographyPresetOptions(document?.textLayers),
        [document?.textLayers]
    );

    useEffect(() => {
        setDrafts(createManualTypographyDrafts(document?.textLayers));
        setMessage("");
    }, [document?.document?.id]);

    if (!document?.textLayers?.length) return null;

    const update = (layerId, field, value) => setDrafts(current => current.map(
        draft => draft.layerId === layerId ? { ...draft, [field]: value } : draft
    ));

    const updatePreset = (layerId, presetId) => {
        const option = presetOptions.find(candidate => candidate.value === presetId);
        setDrafts(current => current.map(draft => draft.layerId === layerId
            ? {
                ...draft,
                presetId,
                preset: cloneTypographyPreset(option?.preset)
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
                Choose a role, edit the text, and optionally reuse a style already present in this template.
            </div>
            {drafts.map(draft => (
                <div key={draft.layerId} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <UxpDropdown
                        value={draft.role}
                        options={ROLE_OPTIONS}
                        onValueChange={value => update(draft.layerId, "role", value)}
                        ariaLabel={`Role for ${draft.layerName}`}
                        title={`Role for ${draft.layerName}`}
                        disabled={!draft.editable || busy}
                    />
                    <UxpDropdown
                        value={draft.presetId}
                        options={presetOptions}
                        onValueChange={value => updatePreset(draft.layerId, value)}
                        ariaLabel={`Style for ${draft.layerName}`}
                        title={`Style for ${draft.layerName}`}
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
        </section>
    );
}
