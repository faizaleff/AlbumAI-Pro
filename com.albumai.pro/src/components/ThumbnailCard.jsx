import React, { useCallback, useState } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

export function StarRatingIcon({ filled = false, className = "" }) {
    return (
        <span
            className={`photo-rating-icon${filled ? " is-filled" : ""}${className ? ` ${className}` : ""}`}
            aria-hidden="true"
        >
            {filled ? "★" : "☆"}
        </span>
    );
}

export function RejectDecisionIcon() {
    return (
        <span className="photo-reject-icon" aria-hidden="true">⊘</span>
    );
}

export function activateDecisionControl(event, callback) {
    if (event.key !== "Enter" && event.key !== " ") return;
    callback(event);
}

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
    eventLabel = "",
    onDecisionChange
}) {
    PhotoBrowserPerformance.recordRender("ThumbnailCard");
    const [hoverRating, setHoverRating] = useState(0);

    const imageHeight = compact ? 74 : 100;
    const rating = decision?.rating || 0;
    const displayedRating = hoverRating || rating;
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
        event.dataTransfer.effectAllowed = "copyMove";
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

    return (
        <div
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            className={`modern-studio-card${selected ? " is-selected" : ""}${rejected ? " is-rejected" : ""}`}
            role="option"
            aria-selected={selected}
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
                className="photo-thumbnail-media"
                draggable={false}
                onDragStart={handleDragStart}
                style={{
                    position: "relative",
                    width: "100%",
                    minHeight: imageHeight,
                    flex: "1 1 auto",
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
                        display: "block",
                        transition: "opacity 90ms ease"
                    }}
                />

                {rejected && (
                    <span className="photo-thumbnail-rejected-dim" aria-hidden="true" />
                )}

                <span
                    role="button"
                    tabIndex={-1}
                    className={`photo-thumbnail-reject${rejected ? " is-rejected" : ""}`}
                    onClick={event => {
                        event.stopPropagation();
                        event.preventDefault();
                        onDecisionChange?.(photo, {
                            culling: rejected ? "UNRATED" : "REJECT"
                        });
                    }}
                    onKeyDown={event => activateDecisionControl(event, keyEvent => {
                        keyEvent.stopPropagation();
                        keyEvent.preventDefault();
                        onDecisionChange?.(photo, {
                            culling: rejected ? "UNRATED" : "REJECT"
                        });
                    })}
                    aria-label={rejected ? `Unreject ${photo.name}` : `Reject ${photo.name}`}
                >
                    <RejectDecisionIcon />
                </span>

                {cameraIdentity && (
                    <span
                        className="photo-camera-tag photo-camera-tag-card photo-thumbnail-camera-overlay"
                        style={{ color: cameraIdentity.color, borderColor: cameraIdentity.color }}
                        aria-label={`Camera ${cameraIdentity.tag}`}
                    >
                        {cameraIdentity.tag}
                    </span>
                )}

            </div>

            {/* Persistent footer: filename plus the decisions already applied. */}
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
                    flex: "0 0 auto",
                    minWidth: 0,
                    boxSizing: "border-box"
                }}
            >
                {/* Filename */}
                <div style={{
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
                {/* Rating and favourite controls stay in one stable footer row. */}
                <div
                    className="photo-thumbnail-footer-actions"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 1,
                        width: "100%",
                        boxSizing: "border-box"
                    }}
                >
                    <span
                        className="photo-thumbnail-footer-stars"
                        role="group"
                        aria-label={`Rate ${photo.name}`}
                        onMouseLeave={() => setHoverRating(0)}
                    >
                        {[1, 2, 3, 4, 5].map(starNum => (
                            <span
                                key={starNum}
                                role="button"
                                tabIndex={-1}
                                onClick={event => handleStarClick(event, starNum)}
                                onMouseEnter={() => setHoverRating(starNum)}
                                onKeyDown={event => activateDecisionControl(
                                    event,
                                    keyEvent => handleStarClick(keyEvent, starNum)
                                )}
                                className={starNum <= displayedRating ? "is-filled" : ""}
                                aria-pressed={starNum === rating}
                                aria-label={`Rate ${starNum} star${starNum > 1 ? "s" : ""}`}
                            >
                                <StarRatingIcon filled={starNum <= displayedRating} />
                            </span>
                        ))}
                    </span>

                    {eventLabel && (
                        <span className="photo-thumbnail-event">{eventLabel}</span>
                    )}

                    <span
                        role="button"
                        tabIndex={-1}
                        className={`photo-thumbnail-footer-favorite${isFavorite ? " is-active" : ""}`}
                        onClick={handleFavoriteClick}
                        onKeyDown={event => activateDecisionControl(event, handleFavoriteClick)}
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
                        aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
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
        previous.eventLabel === next.eventLabel &&
        previous.onDecisionChange === next.onDecisionChange
);
