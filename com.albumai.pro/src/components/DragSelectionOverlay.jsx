import React, { useCallback, useEffect, useRef, useState } from "react";
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
    const animationFrame = useRef(null);
    const start = useRef({ x: 0, y: 0 });
    const latestEvent = useRef(null);

    const [box, setBox] = useState(null);

    const getMousePosition = useCallback((e) => {

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();

        return {
            x: e.clientX - rect.left + container.scrollLeft,
            y: e.clientY - rect.top + container.scrollTop
        };

    }, [containerRef]);

    const updateSelection = useCallback((current) => {

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

        const right = left + width;
        const bottom = top + height;

        let changed = false;

        for (let index = 0; index < photos.length; index++) {

            const row = Math.floor(index / columns);
            const col = index % columns;

            const x = col * (cardWidth + gap);
            const y = row * (cardHeight + gap);

            const hit =
                x < right &&
                x + cardWidth > left &&
                y < bottom &&
                y + cardHeight > top;

            if (photos[index].selected !== hit) {

                photos[index].selected = hit;
                changed = true;

            }

        }

        if (changed) {
            onSelectionChanged();
        }

    }, [
        photos,
        columns,
        cardWidth,
        cardHeight,
        gap,
        onSelectionChanged
    ]);

    const processFrame = useCallback(() => {

        animationFrame.current = null;

        if (!dragging.current || !latestEvent.current)
            return;

        updateSelection(
            getMousePosition(latestEvent.current)
        );

    }, [getMousePosition, updateSelection]);

    const onMouseDown = useCallback((e) => {

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

    }, [getMousePosition]);

    const onMouseMove = useCallback((e) => {

        if (!dragging.current)
            return;

        latestEvent.current = e;

        if (!animationFrame.current) {

            animationFrame.current =
                requestAnimationFrame(processFrame);

        }

    }, [processFrame]);

    const finishDrag = useCallback(() => {

        if (!dragging.current)
            return;

        dragging.current = false;

        if (animationFrame.current) {

            cancelAnimationFrame(animationFrame.current);
            animationFrame.current = null;

        }

        latestEvent.current = null;

        setBox(null);

        onSelectionChanged();

    }, [onSelectionChanged]);

    useEffect(() => {

        window.addEventListener("mouseup", finishDrag);

        return () => {

            window.removeEventListener("mouseup", finishDrag);

            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }

        };

    }, [finishDrag]);

    return (

        <div
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={finishDrag}
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