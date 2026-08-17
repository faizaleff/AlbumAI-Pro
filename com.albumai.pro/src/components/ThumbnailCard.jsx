import React, { useCallback } from "react";
import PhotoImage from "./PhotoImage";
import UxpDropdown from "./UxpDropdown";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

const PHOTO_RATING_OPTIONS = Object.freeze(
    [0, 1, 2, 3, 4, 5].map(rating => Object.freeze({
        value: rating,
        label: rating ? String(rating) : "—"
    }))
);

function ThumbnailCard({
    photo,
    onClick,
    compact = false,
    thumbnailRevision,
    loading,
    selected,
    viewMode = "icons",
    visible = false,
    decision = { rating: 0, favorite: false },
    onDecisionChange
}) {

    PhotoBrowserPerformance.recordRender("ThumbnailCard");
    const imageHeight = compact ? 76 : 110;

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

    return (
        <div
            onClick={handleClick}
            draggable={true}
            onDragStart={handleDragStart}
            className={`photo-thumbnail-card${selected ? " is-selected" : ""}`}
            role="option"
            aria-selected={selected}
            title={photo.name}
            style={{
                width: "100%",
                height: "100%",
                cursor: "grab",
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
                    photo={photo}
                    profile="thumbnail"
                    priority={visible ? 1 : 2}
                    role="browser"
                    onImageLoad={() => {
                        PhotoBrowserPerformance.thumbnailVisible(
                            photo.id
                        );
                    }}
                    alt={photo.name}
                    fallback={status =>
                        status === "loading" ? (
                            <div style={{ color: "#888", fontSize: 12 }}>
                                Loading...
                            </div>
                        ) : placeholder
                    }
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
                <div className="photo-decision-controls">
                    <UxpDropdown
                        value={decision.rating}
                        options={PHOTO_RATING_OPTIONS}
                        onValueChange={rating => {
                            onDecisionChange?.(photo, {
                                rating: Number(rating)
                            });
                        }}
                        className="photo-decision-rating"
                        ariaLabel={`Rate ${photo.name}`}
                        title="Photo rating"
                        stopPropagation
                    />
                    <button
                        type="button"
                        className={decision.favorite ? "is-favorite" : ""}
                        onClick={event => {
                            event.stopPropagation();
                            onDecisionChange?.(photo, {
                                favorite: !decision.favorite
                            });
                        }}
                        aria-pressed={decision.favorite}
                        aria-label={`${decision.favorite ? "Remove" : "Add"} ${photo.name} ${decision.favorite ? "from" : "to"} favourites`}
                        title={decision.favorite
                            ? "Remove from favourites"
                            : "Add to favourites"}
                    >
                        {decision.favorite ? "♥" : "♡"}
                    </button>
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
        previous.selected === next.selected &&
        previous.viewMode === next.viewMode &&
        previous.visible === next.visible
        && previous.decision?.rating === next.decision?.rating
        && previous.decision?.favorite === next.decision?.favorite
        && previous.onDecisionChange === next.onDecisionChange
);
