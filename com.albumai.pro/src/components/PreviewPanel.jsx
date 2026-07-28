import React, { useEffect, useState } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import { getPhotoFileEntry } from "../services/PhotoFileEntry";

function PreviewPanel({
    photos = [],
    selection,
    focusedPhotoId = null,
    executionDetails
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

        const initialId =
            selection.getSelected()[0]?.id || null;
        setSelectedPhotoId(previous =>
            previous === initialId ? previous : initialId
        );

        return selection.subscribe(selectedIds => {
            const selected = photos.find(
                photo => selectedIds.has(photo?.id)
            );
            const nextId = selected?.id || null;
            PhotoBrowserPerformance.recordRenderUpdate(
                "PreviewPanel",
                "selectionSubscription",
                {
                    nextId
                }
            );
            setSelectedPhotoId(previous =>
                previous === nextId ? previous : nextId
            );
        });

    }, [photos, selection]);

    const activePhotoId = focusedPhotoId || selectedPhotoId;
    const activePhoto = activePhotoId == null
        ? null
        : photos.find(photo => photo?.id === activePhotoId) || null;
    const activeFileEntry = getPhotoFileEntry(activePhoto);

    useEffect(() => {
        setPreviewState(activeFileEntry ? "loading" : "unavailable");
    }, [activeFileEntry, activePhoto?.id]);

    useEffect(() => {

        PhotoBrowserPerformance.trace(
            "PREVIEW_SOURCE_CHANGED",
            {
                name: activePhoto?.name || null,
                source: activeFileEntry ? "original-file" : "none"
            }
        );

        return () => {
            PhotoBrowserPerformance.trace(
                "PREVIEW_SOURCE_RELEASED",
                {
                    name: activePhoto?.name || null
                }
            );
        };

    }, [activeFileEntry, activePhoto?.id, activePhoto?.thumbnail]);

    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: "#2b2b2b",
                borderLeft: "1px solid #444",
                padding: 14,
                boxSizing: "border-box",
                color: "#fff",
                minHeight: 0,
                minWidth: 0,
                overflow: "hidden"
            }}
        >
            <div style={{ flex: "0 0 auto", borderBottom: "1px solid #444", paddingBottom: 10 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Preview</h2>

                {!activePhoto && <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>Select a photo</div>}

                {activePhoto && <>
                    <div
                        style={{ position: "relative", height: 240, background: "#1f1f1f", border: "1px solid #444", borderRadius: 6, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <PhotoImage
                            photoId={activePhoto.id}
                            fileEntry={activeFileEntry}
                            cachedSource={null}
                            role="preview"
                            viewMode="preview"
                            retryGeneration={0}
                            alt={activePhoto.name}
                            onImageLoad={() => setPreviewState("ready")}
                            onImageError={() => setPreviewState("unavailable")}
                            fallback={previewState === "loading" ? (
                                <div style={{ color: "#aaa", fontSize: 14 }}>Loading preview…</div>
                            ) : (
                                <div style={{ color: "#888", fontSize: 14 }}>Preview unavailable</div>
                            )}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                display: "block"
                            }}
                        />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4 }}>
                        <div style={{ overflowWrap: "anywhere" }}><strong>Name:</strong> {activePhoto.name}</div>
                        {activePhoto.width > 0 && activePhoto.height > 0 && <div><strong>Dimensions:</strong> {activePhoto.width} × {activePhoto.height}</div>}
                        {activePhoto.file?.size > 0 && <div><strong>Size:</strong> {(activePhoto.file.size / 1024 / 1024).toFixed(2)} MB</div>}
                        {(activePhoto.file?.type || activePhoto.extension) && <div style={{ overflowWrap: "anywhere" }}><strong>Type:</strong> {activePhoto.file?.type || activePhoto.extension}</div>}
                        <div><strong>Status:</strong> {previewState === "ready" ? "Ready" : previewState === "loading" ? "Loading preview…" : "Preview unavailable"}</div>
                    </div>
                </>}
            </div>

            <div
                data-execution-log-viewport="true"
                style={{ flex: 1, minHeight: 0, minWidth: 0, maxWidth: "100%", boxSizing: "border-box", overflowY: "auto", overflowX: "hidden" }}
            >
                {executionDetails}
            </div>
        </div>
    );
}

export default React.memo(PreviewPanel);
