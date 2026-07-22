import React, { useCallback, useEffect, useState } from "react";

import ThumbnailCard from "./ThumbnailCard";
import SelectionService from "../services/SelectionService";
import PhotoImage from "./PhotoImage";

const ICON_WIDTH = 104;
const ICON_HEIGHT = 122;
const LIST_ROW_HEIGHT = 38;

function IconsPhotoView({ photos, onPhotoClick }) {

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "flex-start",
                padding: 6,
                boxSizing: "border-box"
            }}
        >
            {photos.map((photo, index) => (
                <div key={photo.id || photo.name || index} style={{ flex: `0 0 ${ICON_WIDTH}px`, width: ICON_WIDTH, height: ICON_HEIGHT }}>
                    <ThumbnailCard photo={photo} onClick={onPhotoClick} compact />
                </div>
            ))}
        </div>
    );
}

function ListPhotoView({ photos, onPhotoClick }) {

    return (
        <div>
            {photos.map((photo, index) => {
                const selected = photo.selected === true;
                return (
                    <div
                        key={photo.id || photo.name || index}
                        onClick={event => onPhotoClick(photo, event)}
                        style={{
                            height: LIST_ROW_HEIGHT,
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            padding: "0 8px",
                            boxSizing: "border-box",
                            cursor: "pointer",
                            borderBottom: "1px solid #414141",
                            background: selected ? "#334868" : "#292929",
                            color: "#fff"
                        }}
                    >
                        <div style={{ flex: "0 0 30px", width: 30, height: 30, background: "#1f1f1f", overflow: "hidden" }}>
                            <PhotoImage
                                photo={photo}
                                fallback={<div style={{ color: "#777", fontSize: 9, textAlign: "center", lineHeight: "30px" }}>—</div>}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                            />
                        </div>
                        <div style={{ flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12 }}>{photo.name}</div>
                        <div style={{ flex: "0 0 42px", color: "#aaa", fontSize: 11, textTransform: "uppercase" }}>{photo.extension || "—"}</div>
                        <div style={{ flex: "0 0 16px", width: 16, height: 16, borderRadius: 8, background: selected ? "#3B82F6" : "#555", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{selected ? "✓" : ""}</div>
                    </div>
                );
            })}
        </div>
    );
}

export default function ThumbnailGrid({ photos = [], onPhotoClick, viewMode = "icons" }) {

    const [, forceUpdate] = useState(0);

    useEffect(() => {
        SelectionService.setPhotos(photos);
    }, [photos]);

    const handlePhotoClick = useCallback((photo, event) => {
        SelectionService.handleClick(photo, event);
        forceUpdate(value => value + 1);
        onPhotoClick?.(photo);
    }, [onPhotoClick]);

    function renderPhotoView() {

        if (viewMode === "icons") {
            return <IconsPhotoView photos={photos} onPhotoClick={handlePhotoClick} />;
        }

        if (viewMode === "list") {
            return <ListPhotoView photos={photos} onPhotoClick={handlePhotoClick} />;
        }

        return null;
    }

    return (
        <div
            className="photo-browser-viewport"
            data-photo-browser-viewport="true"
            style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                background: "#2f2f2f"
            }}
        >
            {!photos.length ? (
                <div style={{ minHeight: 100, display: "flex", justifyContent: "center", alignItems: "center", color: "#999" }}>No photos loaded.</div>
            ) : (
                renderPhotoView()
            )}
        </div>
    );
}
