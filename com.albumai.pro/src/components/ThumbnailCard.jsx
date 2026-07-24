import React, { useCallback, useState } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

function ThumbnailCard({
    photo,
    onClick,
    compact = false,
    thumbnailRevision,
    loading,
    selected
}) {

    PhotoBrowserPerformance.recordRender("ThumbnailCard");
    const imageHeight = compact ? 76 : 110;
    const [hovered, setHovered] = useState(false);

    const handleClick = useCallback(event => onClick(photo, event), [photo, onClick]);

    return (
        <div
            onClick={handleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: "100%",
                height: "100%",
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                borderRadius: compact ? 4 : 8,
                background: hovered ? "#454545" : "#3a3a3a",
                border: selected ? "2px solid #3B82F6" : hovered ? "2px solid #666" : "2px solid #444"
            }}
        >
            <div
                style={{
                    position: "relative",
                    height: imageHeight,
                    background: "#262626",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                <PhotoImage
                    photo={photo}
                    sourceRevision={thumbnailRevision}
                    loadingRevision={loading}
                    allowFileFallback={false}
                    onImageLoad={() =>
                        PhotoBrowserPerformance.thumbnailVisible(
                            photo.id
                        )
                    }
                    alt={photo.name}
                    fallback={loading ? (
                        <div style={{ color: "#888", fontSize: 12 }}>Loading...</div>
                    ) : (
                        <div style={{ fontSize: 10, color: "#888" }}>No preview</div>
                    )}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                        display: "block"
                    }}
                />

                {selected && (
                    <div
                        style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: compact ? 16 : 22,
                            height: compact ? 16 : 22,
                            borderRadius: "50%",
                            background: "#3B82F6",
                            color: "#fff",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: compact ? 10 : 13,
                            fontWeight: "bold"
                        }}
                    >
                        ✓
                    </div>
                )}
            </div>

            <div style={{ padding: compact ? "4px 5px" : 8 }}>
                <div
                    title={photo.name}
                    style={{
                        fontSize: 11,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    {photo.name}
                </div>
            </div>
        </div>
    );

}

export default React.memo(
    ThumbnailCard,
    (previous, next) =>
        previous.photo?.id === next.photo?.id &&
        previous.photo?.name === next.photo?.name &&
        previous.onClick === next.onClick &&
        previous.compact === next.compact &&
        previous.thumbnailRevision ===
            next.thumbnailRevision &&
        previous.loading === next.loading &&
        previous.selected === next.selected
);
