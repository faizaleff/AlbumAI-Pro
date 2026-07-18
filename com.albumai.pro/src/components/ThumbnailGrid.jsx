import React, { useEffect, useMemo, useRef, useState } from "react";
import ThumbnailCard from "./ThumbnailCard";
import DragSelectionOverlay from "./DragSelectionOverlay";
import SelectionService from "../services/SelectionService";

const CARD_WIDTH = 130;
const CARD_HEIGHT = 170;
const GAP = 10;
const OVERSCAN = 2;

export default function ThumbnailGrid({
    photos = [],
    onPhotoClick
}) {

    const containerRef = useRef(null);

    const [, forceUpdate] = useState(0);

    const [viewport, setViewport] = useState({
        width: 1000,
        height: 700,
        scrollTop: 0
    });

    useEffect(() => {

        SelectionService.setPhotos(photos);

    }, [photos]);

    useEffect(() => {

        function handleKeyDown(e) {

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {

                e.preventDefault();
                SelectionService.selectAll();
                forceUpdate(v => v + 1);

            }

            if (e.key === "Escape") {

                SelectionService.clear();
                forceUpdate(v => v + 1);

            }

        }

        window.addEventListener("keydown", handleKeyDown);

        return () =>
            window.removeEventListener("keydown", handleKeyDown);

    }, []);

    if (!photos.length) {

        return (
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "#2f2f2f",
                    color: "#999"
                }}
            >
                No photos loaded.
            </div>
        );

    }

    const columns = Math.max(
        1,
        Math.floor(viewport.width / (CARD_WIDTH + GAP))
    );

    const totalRows = Math.ceil(photos.length / columns);

    const totalHeight = totalRows * (CARD_HEIGHT + GAP);

    const firstRow = Math.max(
        0,
        Math.floor(viewport.scrollTop / (CARD_HEIGHT + GAP)) - OVERSCAN
    );

    const visibleRows =
        Math.ceil(viewport.height / (CARD_HEIGHT + GAP)) +
        OVERSCAN * 2;

    const startIndex = firstRow * columns;

    const endIndex = Math.min(
        photos.length,
        (firstRow + visibleRows) * columns
    );

    const visiblePhotos = useMemo(() => {

        return photos.slice(startIndex, endIndex);

    }, [photos, startIndex, endIndex]);

    function handleScroll(e) {

        const el = e.currentTarget;

        setViewport({
            width: el.clientWidth,
            height: el.clientHeight,
            scrollTop: el.scrollTop
        });

    }

    function handlePhotoClick(photo, event) {

        SelectionService.handleClick(photo, event);

        forceUpdate(v => v + 1);

        if (onPhotoClick) {

            onPhotoClick(photo);

        }

    }

    return (

        <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{
                flex: 1,
                overflow: "auto",
                background: "#2f2f2f"
            }}
        >

            <div
                style={{
                    position: "relative",
                    height: totalHeight
                }}
            >

                {visiblePhotos.map((photo, index) => {

                    const realIndex = startIndex + index;

                    const row = Math.floor(realIndex / columns);

                    const column = realIndex % columns;

                    return (

                        <div
                            key={photo.file?.nativePath || photo.name}
                            style={{
                                position: "absolute",
                                top: row * (CARD_HEIGHT + GAP),
                                left: column * (CARD_WIDTH + GAP),
                                width: CARD_WIDTH,
                                height: CARD_HEIGHT
                            }}
                        >

                            <ThumbnailCard
                                photo={photo}
                                onClick={handlePhotoClick}
                            />

                        </div>

                    );

                })}

                <DragSelectionOverlay
                    containerRef={containerRef}
                    photos={photos}
                    columns={columns}
                    cardWidth={CARD_WIDTH}
                    cardHeight={CARD_HEIGHT}
                    gap={GAP}
                    onSelectionChanged={() => forceUpdate(v => v + 1)}
                />

            </div>

        </div>

    );

}