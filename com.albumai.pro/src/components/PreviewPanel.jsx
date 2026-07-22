import React from "react";
import PhotoImage from "./PhotoImage";

export default function PreviewPanel({
    photos = [],
    selectedPhotoId = null,
    executionDetails
}) {

    const activePhoto = selectedPhotoId == null
        ? null
        : photos.find(photo => photo?.id === selectedPhotoId) || null;
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
                            photo={activePhoto}
                            alt={activePhoto.name}
                            fallback={activePhoto.loading ? (
                                <div style={{ color: "#aaa", fontSize: 14 }}>Loading...</div>
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
                        <div><strong>Status:</strong> {activePhoto.loaded ? "Ready" : "Loading"}</div>
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
