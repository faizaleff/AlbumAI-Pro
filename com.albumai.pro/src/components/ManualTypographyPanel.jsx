import React, { useEffect, useMemo, useState } from "react";
import UxpDropdown from "./UxpDropdown";

const ROLE_OPTIONS = Object.freeze([
    Object.freeze({ value: "", label: "Choose role" }),
    Object.freeze({ value: "TITLE", label: "Title" }),
    Object.freeze({ value: "CAPTION", label: "Caption" }),
    Object.freeze({ value: "QUOTE", label: "Quote" })
]);

export function createManualTypographyDrafts(textLayers = []) {
    return textLayers.map(layer => ({
        layerId: layer.layerId,
        layerName: layer.layerName || `Layer ${layer.layerId}`,
        role: "",
        text: typeof layer.textContent === "string" ? layer.textContent : "",
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
            preset: null
        }));
}

export function applyTypographyResultToDocument(document, drafts, result) {
    if (!document?.textLayers || result?.status !== "SUCCESS") return document;
    const completed = new Set(result.completedLayerIds || []);
    const textById = new Map(drafts.map(draft => [draft.layerId, draft.text]));
    return {
        ...document,
        textLayers: document.textLayers.map(layer => completed.has(layer.layerId)
            ? { ...layer, textContent: textById.get(layer.layerId) }
            : layer)
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

    useEffect(() => {
        setDrafts(createManualTypographyDrafts(document?.textLayers));
        setMessage("");
    }, [document?.document?.id]);

    if (!document?.textLayers?.length) return null;

    const update = (layerId, field, value) => setDrafts(current => current.map(
        draft => draft.layerId === layerId ? { ...draft, [field]: value } : draft
    ));

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
                Choose an explicit role, edit the text, then apply. Existing Photoshop styling is preserved.
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
