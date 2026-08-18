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
    const [hoverStar, setHoverStar] = useState(0);

    const imageHeight = compact ? 78 : 112;
    const rating = decision?.rating || 0;
    const isFavorite = Boolean(decision?.favorite);
    const culling = decision?.culling?.toLowerCase();

    const handleClick = useCallback(event => {
        onClick(photo, event);
    }, [photo, onClick]);

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

    const activeStarCount = hoverStar > 0 ? hoverStar : rating;

    return (
        <div
            onClick={handleClick}
            draggable={true}
            onDragStart={handleDragStart}
            className={`modern-studio-card${selected ? " is-selected" : ""}`}
            role="option"
            aria-selected={selected}
            title={photo.name}
        >
            {/* Image Thumbnail Box */}
            <div className="card-thumb-container" style={{ height: imageHeight }}>
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
                            <div className="thumb-loading-text">Loading…</div>
                        ) : (
                            <div className="thumb-fallback-icon">▧</div>
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

                {/* Selection Badge */}
                {selected && (
                    <div className="card-select-badge" aria-label="Selected">
                        ✓
                    </div>
                )}

                {/* Culling Badge (Keep / Reject) */}
                {culling && culling !== "unrated" && (
                    <div className={`card-cull-badge ${culling}`}>
                        {culling === "keep" ? "✓ KEEP" : "✕ REJECT"}
                    </div>
                )}

                {/* Modern Studio Rating & Action Bar (CSS-driven Hover Overlay - No Flicker) */}
                <div
                    className="card-hover-action-bar"
                    onMouseLeave={() => setHoverStar(0)}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="card-stars-row">
                        {[1, 2, 3, 4, 5].map(starNum => {
                            const isFilled = starNum <= activeStarCount;
                            return (
                                <button
                                    key={starNum}
                                    type="button"
                                    onClick={(e) => handleStarClick(e, starNum)}
                                    onMouseEnter={() => setHoverStar(starNum)}
                                    className={`star-btn${isFilled ? " filled" : ""}`}
                                    title={`Rate ${starNum} star${starNum > 1 ? "s" : ""} (${starNum})`}
                                >
                                    ★
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={handleFavoriteClick}
                        className={`fav-btn${isFavorite ? " active" : ""}`}
                        title={isFavorite ? "Remove from favourites (F)" : "Add to favourites (F)"}
                    >
                        {isFavorite ? "♥" : "♡"}
                    </button>
                </div>
            </div>

            {/* Card Footer Meta */}
            <div className="card-footer-meta">
                <span className="photo-title" title={photo.name}>
                    {photo.name}
                </span>
                {rating > 0 && (
                    <span className="rating-pill">
                        ★ {rating}
                    </span>
                )}
                {isFavorite && (
                    <span className="fav-pill" title="Favorite">
                        ♥
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
