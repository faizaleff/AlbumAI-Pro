import React, { useRef, useState } from "react";
import SelectionService from "../services/SelectionService";

export default function DragSelectionOverlay({
    containerRef,
    photos,
    columns,
    cardWidth,
    cardHeight,
    gap,
    onSelectionChanged
}) {

    const dragging = useRef(false);
    const start = useRef({ x: 0, y: 0 });

    const [box, setBox] = useState(null);

    function getMousePosition(e) {

        const rect = containerRef.current.getBoundingClientRect();

        return {
            x: e.clientX - rect.left + containerRef.current.scrollLeft,
            y: e.clientY - rect.top + containerRef.current.scrollTop
        };

    }

    function onMouseDown(e) {

        if (e.button !== 0)
            return;

        dragging.current = true;

        start.current = getMousePosition(e);

        if (!(e.ctrlKey || e.metaKey)) {

            SelectionService.clear();

        }

        setBox({
            left: start.current.x,
            top: start.current.y,
            width: 0,
            height: 0
        });

    }

    function onMouseMove(e) {

        if (!dragging.current)
            return;

        const current = getMousePosition(e);

        const left = Math.min(start.current.x, current.x);
        const top = Math.min(start.current.y, current.y);

        const width = Math.abs(current.x - start.current.x);
        const height = Math.abs(current.y - start.current.y);

        setBox({
            left,
            top,
            width,
            height
        });

        photos.forEach((photo, index) => {

            const row = Math.floor(index / columns);
            const col = index % columns;

            const x = col * (cardWidth + gap);
            const y = row * (cardHeight + gap);

            const hit =
                x < left + width &&
                x + cardWidth > left &&
                y < top + height &&
                y + cardHeight > top;

            photo.selected = hit;

        });

        onSelectionChanged();

    }

    function onMouseUp() {

        dragging.current = false;
        setBox(null);
        onSelectionChanged();

    }

    return (

        <div
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 20
            }}
        >

            {box && (

                <div
                    style={{
                        position: "absolute",
                        left: box.left,
                        top: box.top,
                        width: box.width,
                        height: box.height,
                        background: "rgba(59,130,246,.15)",
                        border: "1px solid #3B82F6",
                        pointerEvents: "none"
                    }}
                />

            )}

        </div>

    );

}