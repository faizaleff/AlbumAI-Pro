import React, { useEffect, useState } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import ExecutionDetailsPanel from "./ExecutionDetailsPanel";

function PreviewPanel({
    photos = [],
    selection,
    focusedPhotoId = null,
    executionDetails = null,
    diagnostics = null
}) {
    PhotoBrowserPerformance.recordRender("PreviewPanel");
    const [selectedPhotoId, setSelectedPhotoId] = useState(
        () => selection?.getSelected()[0]?.id || null
    );
    const [previewState, setPreviewState] = useState("idle");

    useEffect(() => {
        PhotoBrowserPerformance.recordRenderUpdate(
            "PreviewPanel",
            "selectionEffectEntry"
        );
        if (!selection) return undefined;
        const initialId = selection.getSelected()[0]?.id || null;
        setSelectedPhotoId(previous => previous === initialId ? previous : initialId);

        return selection.subscribe(selectedIds => {
            const selected = photos.find(photo => selectedIds.has(photo?.id));
            const nextId = selected?.id || null;
            PhotoBrowserPerformance.recordRenderUpdate(
                "PreviewPanel",
                "selectionSubscription",
                { nextId }
            );
            setSelectedPhotoId(previous => previous === nextId ? previous : nextId);
        });
    }, [photos, selection]);

    const activePhotoId = focusedPhotoId || selectedPhotoId;
    const activePhoto = activePhotoId == null
        ? null
        : photos.find(photo => photo?.id === activePhotoId) || null;

    useEffect(() => {
        if (!activePhoto) {
            setPreviewState("unavailable");
            return undefined;
        }
        setPreviewState("loading");
        return undefined;
    }, [activePhoto]);

    const cameraModel = (activePhoto?.metadata?.cameraMake || activePhoto?.metadata?.cameraModel)
        ? `${activePhoto.metadata.cameraMake || ""} ${activePhoto.metadata.cameraModel || ""}`.trim()
        : null;

    const dateTaken = (activePhoto?.metadata?.dateTaken || activePhoto?.dateTaken || activePhoto?.modified)
        ? new Date(activePhoto?.metadata?.dateTaken || activePhoto?.dateTaken || activePhoto?.modified).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
        : null;

    return (
        <div
            className="album-preview-panel"
            style={{
                display: "flex",
                flexDirection: "column",
                background: "#161b22",
                borderLeft: "1px solid #30363d",
                padding: 12,
                boxSizing: "border-box",
                color: "#f0f6fc",
                minHeight: 0,
                minWidth: 0,
                overflow: "hidden"
            }}
        >
            <div style={{ flex: "0 0 auto", borderBottom: "1px solid #30363d", paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f6fc", letterSpacing: "0.02em" }}>
                        🔍 Inspector Preview
                    </span>
                    {activePhoto && (
                        <span style={{ fontSize: 10, background: "#21262d", border: "1px solid #30363d", borderRadius: 10, padding: "1px 6px", color: "#8b949e" }}>
                            {activePhoto.extension || "JPEG"}
                        </span>
                    )}
                </div>

                {!activePhoto && (
                    <div style={{ height: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6e7681", background: "#0d1117", borderRadius: 6, border: "1px dashed #30363d" }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
                        <div style={{ fontSize: 11 }}>Select a photo to preview</div>
                    </div>
                )}

                {activePhoto && (
                    <>
                        <div
                            style={{
                                position: "relative",
                                height: 160,
                                maxHeight: 180,
                                minHeight: 120,
                                flex: "0 1 auto",
                                background: "#0d1117",
                                border: "1px solid #30363d",
                                borderRadius: 6,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}
                        >
                            <PhotoImage
                                photo={activePhoto}
                                profile="preview"
                                priority={0}
                                role="preview"
                                alt={activePhoto.name}
                                onImageLoad={() => setPreviewState("ready")}
                                onImageError={() => setPreviewState("unavailable")}
                                fallback={previewState === "loading" ? (
                                    <div style={{ color: "#8b949e", fontSize: 12 }}>Loading high-res preview…</div>
                                ) : (
                                    <div style={{ color: "#6e7681", fontSize: 12 }}>Preview unavailable</div>
                                )}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    display: "block"
                                }}
                            />
                        </div>

                        {/* Metadata Details Card */}
                        <div style={{ marginTop: 8, padding: "6px 8px", background: "#1c2128", border: "1px solid #30363d", borderRadius: 6, fontSize: 11, lineHeight: 1.5 }}>
                            <div style={{ overflowWrap: "anywhere", fontWeight: 600, color: "#f0f6fc", marginBottom: 2 }}>
                                {activePhoto.name}
                            </div>
                            {cameraModel && (
                                <div style={{ color: "#58a6ff" }}>
                                    📷 {cameraModel}
                                </div>
                            )}
                            {dateTaken && (
                                <div style={{ color: "#8b949e" }}>
                                    🕐 {dateTaken}
                                </div>
                            )}
                            <div style={{ display: "flex", gap: 8, color: "#8b949e", marginTop: 2 }}>
                                {activePhoto.width > 0 && activePhoto.height > 0 && (
                                    <span>📐 {activePhoto.width} × {activePhoto.height}</span>
                                )}
                                {activePhoto.file?.size > 0 && (
                                    <span>💾 {(activePhoto.file.size / 1024 / 1024).toFixed(1)} MB</span>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div
                data-execution-log-viewport="true"
                style={{ flex: 1, minHeight: 0, minWidth: 0, maxWidth: "100%", boxSizing: "border-box", overflowY: "auto", overflowX: "hidden", marginTop: 8 }}
            >
                {executionDetails || (diagnostics ? <ExecutionDetailsPanel {...diagnostics} /> : null)}
            </div>
        </div>
    );
}

export default React.memo(PreviewPanel);
