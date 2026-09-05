import React, { useCallback, useState } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

function ThumbnailCard({
    photo,
    onClick,
    onContextMenu,
    compact = false,
    thumbnailRevision,
    loading,
    selected,
    viewMode = "icons",
    visible = false,
    decision = { rating: 0, favorite: false, culling: "unrated" },
    cameraIdentity = null,
    onDecisionChange
}) {
    PhotoBrowserPerformance.recordRender("ThumbnailCard");
    const [hoverStar, setHoverStar] = useState(0);

    const imageHeight = compact ? 74 : 100;
    const rating = decision?.rating || 0;
    const isFavorite = Boolean(decision?.favorite);
    const culling = decision?.culling?.toLowerCase();
    const rejected = culling === "reject";

    const handleClick = useCallback(event => {
        onClick(photo, event);
    }, [photo, onClick]);

    const handleContextMenu = useCallback(event => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(event, photo);
    }, [photo, onContextMenu]);

    const handleDragStart = useCallback(event => {
        if (!photo?.id) return;
        event.dataTransfer.setData("application/json", JSON.stringify({
            type: "ALBUMAI_PHOTO",
            photoId: photo.id,
            photoName: photo.name
        }));
        event.dataTransfer.setData("text/plain", String(photo.id));
        event.dataTransfer.effectAllowed = "copy";
    }, [photo]);

    const handleStarClick = (event, starValue) => {
        event.stopPropagation();
        event.preventDefault();
        const nextRating = rating === starValue ? 0 : starValue;
        onDecisionChange?.(photo, { rating: nextRating });
    };

    const handleFavoriteClick = (event) => {
        event.stopPropagation();
        event.preventDefault();
        onDecisionChange?.(photo, { favorite: !isFavorite });
    };

    const displayStars = hoverStar > 0 ? hoverStar : rating;

    return (
        <div
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            className={`modern-studio-card${selected ? " is-selected" : ""}`}
            role="option"
            aria-selected={selected}
            title={photo.name}
            style={{
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                background: selected ? "#162338" : "#151b23",
                border: selected ? "1px solid #00d2ff" : "1px solid #30363d",
                boxShadow: selected ? "0 0 10px rgba(0, 210, 255, 0.4)" : "none",
                borderRadius: 6,
                overflow: "hidden",
                cursor: "pointer",
                userSelect: "none"
            }}
        >
            {/* Image Thumbnail Box */}
            <div
                draggable={true}
                onDragStart={handleDragStart}
                style={{
                    position: "relative",
                    width: "100%",
                    height: imageHeight,
                    background: "#0d1117",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "grab"
                }}
            >
                <PhotoImage
                    photo={photo}
                    profile="thumbnail"
                    priority={visible ? 1 : 2}
                    role="browser"
                    onImageLoad={() => {
                        PhotoBrowserPerformance.thumbnailVisible(photo.id);
                    }}
                    alt={photo.name}
                    fallback={status =>
                        status === "loading" ? (
                            <div style={{ color: "#8b949e", fontSize: 10 }}>Loading…</div>
                        ) : (
                            <div style={{ color: "#484f58", fontSize: 18 }}>▧</div>
                        )
                    }
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                        display: "block"
                    }}
                />

                <button
                    type="button"
                    className={`photo-thumbnail-reject${rejected ? " is-rejected" : ""}`}
                    onClick={event => {
                        event.stopPropagation();
                        event.preventDefault();
                        onDecisionChange?.(photo, {
                            culling: rejected ? "UNRATED" : "REJECT"
                        });
                    }}
                    aria-label={rejected ? `Unreject ${photo.name}` : `Reject ${photo.name}`}
                    title={rejected ? "Unreject (R)" : "Reject (R)"}
                >
                    {rejected ? "↶" : "⊘"}
                </button>

            </div>

            {/* Card Footer: Row 1 = Filename, Row 2 = 5 Stars + Heart */}
            <div
                style={{
                    padding: "3px 6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    background: cameraIdentity?.color
                        ? `linear-gradient(90deg, ${cameraIdentity.color}22, #151b23 58%)`
                        : selected ? "#162338" : "#151b23",
                    borderBottom: cameraIdentity?.color
                        ? `3px solid ${cameraIdentity.color}`
                        : "3px solid transparent",
                    minWidth: 0,
                    boxSizing: "border-box"
                }}
            >
                {/* Filename */}
                <div
                    title={photo.name}
                    style={{
                        fontSize: 10,
                        color: selected ? "#ffffff" : "#c9d1d9",
                        fontWeight: selected ? 600 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.2
                    }}
                >
                    {photo.name}
                </div>
                {cameraIdentity && (
                    <span className="photo-camera-tag photo-camera-tag-card" style={{ color: cameraIdentity.color }}>
                        {cameraIdentity.tag}
                    </span>
                )}

                {/* 5 Stars Rating + Favorite Heart (Explicit zero-min-width styling for UXP) */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 1,
                        width: "100%",
                        boxSizing: "border-box"
                    }}
                    onMouseLeave={() => setHoverStar(0)}
                >
                    {/* 5-Star Row (All 5 Stars Tightly Spaced) */}
                    <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
                        {[1, 2, 3, 4, 5].map(starNum => {
                            const isFilled = starNum <= displayStars;
                            return (
                                <span
                                    key={starNum}
                                    role="button"
                                    onClick={(e) => handleStarClick(e, starNum)}
                                    onMouseEnter={() => setHoverStar(starNum)}
                                    style={{
                                        cursor: "pointer",
                                        fontSize: 12,
                                        lineHeight: 1,
                                        width: 12,
                                        height: 14,
                                        minWidth: 0,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: isFilled ? "#ffd700" : "#484f58",
                                        transition: "color 0.1s ease, transform 0.1s ease",
                                        userSelect: "none"
                                    }}
                                    title={`Rate ${starNum} star${starNum > 1 ? "s" : ""} (${starNum})`}
                                >
                                    ★
                                </span>
                            );
                        })}
                    </div>

                    {/* Heart Button */}
                    <span
                        role="button"
                        onClick={handleFavoriteClick}
                        style={{
                            cursor: "pointer",
                            fontSize: 13,
                            lineHeight: 1,
                            minWidth: 0,
                            padding: "0 2px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: isFavorite ? "#ff4d4f" : "#6e7681",
                            transition: "color 0.1s ease, transform 0.1s ease",
                            userSelect: "none"
                        }}
                        title={isFavorite ? "Remove from favourites (F)" : "Add to favourites (F)"}
                    >
                        {isFavorite ? "♥" : "♡"}
                    </span>
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
        previous.onContextMenu === next.onContextMenu &&
        previous.compact === next.compact &&
        previous.thumbnailRevision === next.thumbnailRevision &&
        previous.loading === next.loading &&
        previous.selected === next.selected &&
        previous.viewMode === next.viewMode &&
        previous.visible === next.visible &&
        previous.decision?.rating === next.decision?.rating &&
        previous.decision?.favorite === next.decision?.favorite &&
        previous.decision?.culling === next.decision?.culling &&
        previous.cameraIdentity?.tag === next.cameraIdentity?.tag &&
        previous.cameraIdentity?.color === next.cameraIdentity?.color &&
        previous.onDecisionChange === next.onDecisionChange
);
