import React, { useCallback, useState } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

function ThumbnailCard({
    photo,
    onClick,
    compact = false,
    thumbnailRevision,
    loading,
    selected,
    viewMode = "icons",
    visible = false,
    decision = { rating: 0, favorite: false, culling: "unrated" },
    onDecisionChange
}) {
    PhotoBrowserPerformance.recordRender("ThumbnailCard");
    const [hoverRating, setHoverRating] = useState(0);
    const [isCardHovered, setIsCardHovered] = useState(false);

    const imageHeight = compact ? 76 : 110;
    const rating = decision?.rating || 0;
    const isFavorite = Boolean(decision?.favorite);
    const culling = decision?.culling?.toLowerCase();

    const handleClick = useCallback(event => onClick(photo, event), [photo, onClick]);

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
        const nextRating = rating === starValue ? 0 : starValue;
        onDecisionChange?.(photo, { rating: nextRating });
    };

    const handleFavoriteClick = (event) => {
        event.stopPropagation();
        onDecisionChange?.(photo, { favorite: !isFavorite });
    };

    const activeRatingDisplay = hoverRating > 0 ? hoverRating : rating;

    return (
        <div
            onClick={handleClick}
            draggable={true}
            onDragStart={handleDragStart}
            onMouseEnter={() => setIsCardHovered(true)}
            onMouseLeave={() => {
                setIsCardHovered(false);
                setHoverRating(0);
            }}
            className={`photo-thumbnail-card${selected ? " is-selected" : ""}${isCardHovered ? " is-hovered" : ""}`}
            role="option"
            aria-selected={selected}
            title={photo.name}
            style={{
                width: "100%",
                height: "100%",
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                borderRadius: compact ? 6 : 8,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                background: selected ? "#1c2c40" : "#1c2128",
                border: selected ? "2px solid #388bfd" : "1px solid #30363d",
                transition: "all 0.15s ease",
                boxShadow: selected ? "0 0 10px rgba(56, 139, 253, 0.35)" : "none"
            }}
        >
            {/* Image Thumbnail Container */}
            <div
                style={{
                    position: "relative",
                    height: imageHeight,
                    background: "#0d1117",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden"
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
                            <div style={{ color: "#6e7681", fontSize: 11 }}>Loading…</div>
                        ) : (
                            <div style={{ color: "#484f58", fontSize: 18 }}>▧</div>
                        )
                    }
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                        display: "block",
                        transition: "transform 0.2s ease",
                        transform: isCardHovered ? "scale(1.04)" : "scale(1)"
                    }}
                />

                {/* Top-Right Selection Checkmark Badge */}
                {selected && (
                    <div
                        style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: compact ? 18 : 22,
                            height: compact ? 18 : 22,
                            borderRadius: "50%",
                            background: "#1f6feb",
                            border: "1px solid #ffffff",
                            color: "#fff",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: compact ? 11 : 13,
                            fontWeight: "bold",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                            zIndex: 3
                        }}
                    >
                        ✓
                    </div>
                )}

                {/* Top-Left Culling Status Badge (Keep / Reject) */}
                {culling && culling !== "unrated" && (
                    <div
                        style={{
                            position: "absolute",
                            top: 4,
                            left: 4,
                            padding: "1px 5px",
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            background: culling === "keep" ? "rgba(35, 134, 54, 0.9)" : "rgba(218, 54, 51, 0.9)",
                            color: "#ffffff",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
                            zIndex: 3
                        }}
                    >
                        {culling === "keep" ? "✓ KEEP" : "✕ REJECT"}
                    </div>
                )}

                {/* Bottom Overlay: Bridge-Style Responsive Star Rating & Heart Favorite */}
                {(isCardHovered || rating > 0 || isFavorite) && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "3px 6px",
                            background: isCardHovered ? "rgba(13, 17, 23, 0.88)" : "rgba(13, 17, 23, 0.65)",
                            backdropFilter: "blur(4px)",
                            transition: "all 0.15s ease",
                            zIndex: 4
                        }}
                    >
                        {/* 5-Star Rating Buttons */}
                        <div
                            style={{ display: "flex", gap: 1 }}
                            onMouseLeave={() => setHoverRating(0)}
                        >
                            {[1, 2, 3, 4, 5].map(starNum => {
                                const isStarActive = starNum <= activeRatingDisplay;
                                return (
                                    <button
                                        key={starNum}
                                        type="button"
                                        onClick={(e) => handleStarClick(e, starNum)}
                                        onMouseEnter={() => setHoverRating(starNum)}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            padding: 0,
                                            margin: 0,
                                            cursor: "pointer",
                                            fontSize: compact ? 12 : 14,
                                            lineHeight: 1,
                                            color: isStarActive ? "#e3b341" : (isCardHovered ? "#484f58" : "transparent"),
                                            transition: "transform 0.1s ease, color 0.1s ease",
                                            transform: hoverRating === starNum ? "scale(1.25)" : "scale(1)"
                                        }}
                                        title={`Rate ${starNum} star${starNum > 1 ? "s" : ""}`}
                                    >
                                        ★
                                    </button>
                                );
                            })}
                        </div>

                        {/* Heart Favorite Button */}
                        <button
                            type="button"
                            onClick={handleFavoriteClick}
                            style={{
                                border: "none",
                                background: "transparent",
                                padding: "0 2px",
                                margin: 0,
                                cursor: "pointer",
                                fontSize: compact ? 12 : 14,
                                lineHeight: 1,
                                color: isFavorite ? "#f85149" : (isCardHovered ? "#6e7681" : "transparent"),
                                transition: "transform 0.15s ease, color 0.15s ease",
                                transform: isFavorite ? "scale(1.1)" : "scale(1)"
                            }}
                            title={isFavorite ? "Remove from favourites (F)" : "Add to favourites (F)"}
                        >
                            {isFavorite ? "♥" : "♡"}
                        </button>
                    </div>
                )}
            </div>

            {/* Card Footer Info */}
            <div
                style={{
                    padding: compact ? "4px 6px" : "6px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: selected ? "#1c2c40" : "#161b22",
                    minWidth: 0
                }}
            >
                <span
                    title={photo.name}
                    style={{
                        fontSize: 10,
                        color: selected ? "#ffffff" : "#c9d1d9",
                        fontWeight: selected ? 600 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1
                    }}
                >
                    {photo.name}
                </span>
                {photo.extension && (
                    <span style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", marginLeft: 4, flexShrink: 0 }}>
                        {photo.extension}
                    </span>
                )}
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
        previous.thumbnailRevision === next.thumbnailRevision &&
        previous.loading === next.loading &&
        previous.selected === next.selected &&
        previous.viewMode === next.viewMode &&
        previous.visible === next.visible &&
        previous.decision?.rating === next.decision?.rating &&
        previous.decision?.favorite === next.decision?.favorite &&
        previous.decision?.culling === next.decision?.culling &&
        previous.onDecisionChange === next.onDecisionChange
);
