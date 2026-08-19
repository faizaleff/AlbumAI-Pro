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
        <div className="album-preview-panel">
            <div style={{ flex: "0 0 auto", borderBottom: "1px solid #30363d", paddingBottom: 8 }}>
                <div className="inspector-preview-header">
                    <span className="inspector-preview-title">
                        🔍 Inspector Preview
                    </span>
                    {activePhoto && (
                        <span className="inspector-badge">
                            {activePhoto.extension || "JPEG"}
                        </span>
                    )}
                </div>

                {!activePhoto && (
                    <div className="inspector-preview-empty">
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
                        <div style={{ fontSize: 11 }}>Select a photo to preview</div>
                    </div>
                )}

                {activePhoto && (
                    <>
                        <div className="inspector-preview-box">
                            <PhotoImage
                                photo={activePhoto}
                                profile="preview"
                                priority={0}
                                role="preview"
                                alt={activePhoto.name}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    display: "block"
                                }}
                                onImageLoad={() => setPreviewState("ready")}
                                onImageError={() => setPreviewState("unavailable")}
                                fallback={previewState === "loading" ? (
                                    <div style={{ color: "#8b949e", fontSize: 12 }}>Loading high-res preview…</div>
                                ) : (
                                    <div style={{ color: "#6e7681", fontSize: 12 }}>Preview unavailable</div>
                                )}
                            />
                        </div>

                        {/* Metadata Details Card */}
                        <div className="inspector-metadata-card">
                            <div className="inspector-metadata-filename">
                                {activePhoto.name}
                            </div>
                            {cameraModel && (
                                <div className="inspector-metadata-camera">
                                    📷 {cameraModel}
                                </div>
                            )}
                            {dateTaken && (
                                <div className="inspector-metadata-date">
                                    🕐 {dateTaken}
                                </div>
                            )}
                            <div className="inspector-metadata-stats">
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
