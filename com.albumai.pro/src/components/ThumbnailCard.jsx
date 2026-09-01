import React, { useCallback, useState } from "react";
import PhotoImage from "./PhotoImage";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

const COLOR_LABELS = Object.freeze({
    6: "#e24e5b",
    7: "#e3ae38",
    8: "#31a66f"
});

function ThumbnailCard({
    photo,
    onClick,
    compact = false,
    thumbnailRevision,
    loading,
    selected,
    viewMode = "icons",
    visible = false,
    decision = { rating: 0, culling: "unrated" },
    onDecisionChange,
    decisionControlsVisible = true,
    manualOrderEnabled = false,
    onReorderDrop
}) {
    PhotoBrowserPerformance.recordRender("ThumbnailCard");
    const [hoverStar, setHoverStar] = useState(0);
    const [reorderTarget, setReorderTarget] = useState(false);

    const imageHeight = compact ? 74 : 100;
    const rating = decision?.rating || 0;
    const colorLabel = Number(decision?.colorLabel) || 0;
    const colorStroke = COLOR_LABELS[colorLabel] || null;
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
        event.dataTransfer.effectAllowed = manualOrderEnabled ? "copyMove" : "copy";
    }, [manualOrderEnabled, photo]);

    const handleDragOver = useCallback(event => {
        if (!manualOrderEnabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setReorderTarget(true);
    }, [manualOrderEnabled]);

    const handleDrop = useCallback(event => {
        if (!manualOrderEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        setReorderTarget(false);
        onReorderDrop?.(event.dataTransfer.getData("text/plain"), photo);
    }, [manualOrderEnabled, onReorderDrop, photo]);

    const handleStarClick = (event, starValue) => {
        event.stopPropagation();
        event.preventDefault();
        const nextRating = rating === starValue ? 0 : starValue;
        onDecisionChange?.(photo, { rating: nextRating });
    };

    const handleDecisionClick = (event, cullingValue) => {
        event.stopPropagation();
        event.preventDefault();
        onDecisionChange?.(photo, { culling: cullingValue });
    };

    const handleColorClick = (event, value) => {
        event.stopPropagation();
        event.preventDefault();
        onDecisionChange?.(photo, {
            colorLabel: colorLabel === value ? 0 : value
        });
    };

    const displayStars = hoverStar > 0 ? hoverStar : rating;

    return (
        <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={() => setReorderTarget(false)}
            onDrop={handleDrop}
            className={`modern-studio-card${selected ? " is-selected" : ""}${reorderTarget ? " is-reorder-target" : ""}`}
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
                boxShadow: selected
                    ? `0 0 10px rgba(0, 210, 255, 0.4)${colorStroke ? `, inset 0 0 0 3px ${colorStroke}` : ""}`
                    : colorStroke ? `inset 0 0 0 3px ${colorStroke}` : "none",
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

                {rating > 0 && (
                    <span className="photo-card-persistent-rating" aria-label={`${rating} star rating`}>
                        {"★".repeat(rating)}
                    </span>
                )}

                {decisionControlsVisible && (
                    <div className="photo-card-hover-controls" aria-label={`Rate and label ${photo.name}`}>
                        <div className="photo-card-hover-decisions">
                            <button type="button" onClick={event => handleDecisionClick(event, "KEEP")} title="Keep (K)">✓</button>
                            <button type="button" onClick={event => handleDecisionClick(event, "REJECT")} title="Reject (R)">×</button>
                        </div>
                        <div className="photo-card-hover-rating" onMouseLeave={() => setHoverStar(0)}>
                            <div>
                                {[1, 2, 3, 4, 5].map(starNum => (
                                    <button
                                        key={starNum}
                                        type="button"
                                        className={starNum <= displayStars ? "is-active" : ""}
                                        onClick={event => handleStarClick(event, starNum)}
                                        onMouseEnter={() => setHoverStar(starNum)}
                                        title={`${starNum} star${starNum > 1 ? "s" : ""} (${starNum})`}
                                    >★</button>
                                ))}
                            </div>
                            <div>
                                {Object.entries(COLOR_LABELS).map(([value, color]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`photo-card-color${colorLabel === Number(value) ? " is-active" : ""}`}
                                        style={{ background: color }}
                                        onClick={event => handleColorClick(event, Number(value))}
                                        title={`Color label ${value}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Selection Badge */}
                {selected && (
                    <div
                        style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#00d2ff",
                            color: "#0b0e14",
                            fontWeight: 800,
                            fontSize: 11,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 6px rgba(0, 210, 255, 0.6)",
                            zIndex: 4
                        }}
                    >
                        ✓
                    </div>
                )}

                {/* Culling Badge (Keep / Reject) */}
                {decisionControlsVisible && culling && culling !== "unrated" && (
                    <div
                        style={{
                            position: "absolute",
                            top: 4,
                            left: 4,
                            padding: "1px 5px",
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#ffffff",
                            background: culling === "keep" ? "#238636" : "#da3633",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.6)",
                            zIndex: 4
                        }}
                    >
                        {culling === "keep" ? "✓ KEEP" : "✕ REJECT"}
                    </div>
                )}
            </div>

            {/* Card Footer: Row 1 = Filename, Row 2 = 5 Stars + Heart */}
            <div
                style={{
                    padding: "3px 6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    background: selected ? "#162338" : "#151b23",
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
                    <div className="photo-card-rating-summary">
                        {rating ? `${"★".repeat(rating)}` : "Unrated"}
                    </div>

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
        previous.thumbnailRevision === next.thumbnailRevision &&
        previous.loading === next.loading &&
        previous.selected === next.selected &&
        previous.viewMode === next.viewMode &&
        previous.visible === next.visible &&
        previous.decision?.rating === next.decision?.rating &&
        previous.decision?.colorLabel === next.decision?.colorLabel &&
        previous.decision?.culling === next.decision?.culling &&
        previous.decisionControlsVisible === next.decisionControlsVisible &&
        previous.onDecisionChange === next.onDecisionChange
);
