import React, { useCallback, useEffect } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import ThumbnailService, {
    getThumbnailCacheKey
} from "../services/ThumbnailService";
import { getPhotoFileEntry } from "../services/PhotoFileEntry";

function ThumbnailCard({
    photo,
    onClick,
    compact = false,
    thumbnailRevision,
    loading,
    selected,
    viewMode = "icons",
    visible = false
}) {

    PhotoBrowserPerformance.recordRender("ThumbnailCard");
    const imageHeight = compact ? 76 : 110;
    const cacheKey = getThumbnailCacheKey(photo);
    const cachedThumbnail = ThumbnailService.getCachedThumbnail(photo, {
        viewMode,
        visible,
        diagnostic: false
    });

    useEffect(() => {
        ThumbnailService.getCachedThumbnail(photo, { viewMode, visible });
        PhotoBrowserPerformance.trace("THUMB_CARD_REMOUNT", {
            photoId: photo?.id || null,
            cacheKey,
            generation: null,
            viewMode,
            visible
        });
    }, [cacheKey, photo?.id, viewMode, visible]);

    const handleClick = useCallback(event => onClick(photo, event), [photo, onClick]);
    const dimensions = photo.width > 0 && photo.height > 0
        ? `${photo.width} × ${photo.height}`
        : null;
    const date = photo.modified || photo.created;
    const dateLabel = date
        ? new Date(date).toLocaleDateString()
        : null;
    const placeholder = (
        <div style={{ color: "#999", textAlign: "center", lineHeight: 1.25, padding: 6, maxWidth: "100%" }}>
            <div style={{ fontSize: 24, color: "#666" }}>▧</div>
            <div style={{ fontSize: 10 }}>Thumbnail unavailable</div>
            <div style={{ fontSize: 9, color: "#777", marginTop: 2 }}>
                {photo.name || "Unnamed file"} · {photo.extension || "FILE"}
            </div>
            {(dimensions || dateLabel) && (
                <div style={{ fontSize: 8, color: "#707070", marginTop: 3 }}>
                    {[dimensions, dateLabel].filter(Boolean).join(" · ")}
                </div>
            )}
        </div>
    );

    return (
        <div
            onClick={handleClick}
            className={`photo-thumbnail-card${selected ? " is-selected" : ""}`}
            role="option"
            aria-selected={selected}
            title={photo.name}
            style={{
                width: "100%",
                height: "100%",
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                borderRadius: compact ? 5 : 8
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
                    photoId={photo.id}
                    fileEntry={getPhotoFileEntry(photo)}
                    cachedSource={cachedThumbnail || thumbnailRevision}
                    role="browser"
                    viewMode={viewMode}
                    retryGeneration={thumbnailRevision}
                    cacheKey={cacheKey}
                    visible={visible}
                    onImageLoad={() =>
                        PhotoBrowserPerformance.thumbnailVisible(
                            photo.id
                        )
                    }
                    alt={photo.name}
                    fallback={loading && !photo.thumbnailUnavailable ? (
                        <div style={{ color: "#888", fontSize: 12 }}>Loading...</div>
                    ) : placeholder}
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
        previous.photo?.file === next.photo?.file &&
        previous.photo?.name === next.photo?.name &&
        previous.onClick === next.onClick &&
        previous.compact === next.compact &&
        previous.thumbnailRevision ===
            next.thumbnailRevision &&
        previous.loading === next.loading &&
        previous.selected === next.selected
);
