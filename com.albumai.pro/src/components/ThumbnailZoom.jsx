import React, { useEffect, useRef } from "react";

export function thumbnailZoomState(value) {
    const step = Math.max(0, Math.min(49, Math.round(Number(value) || 0)));
    return {viewMode:step === 0 ? "list" : "icons", thumbnailSize:124 + Math.max(0, step - 1)};
}
export function thumbnailZoomValue(viewMode, size) {
    return viewMode === "list" ? 0 : Math.max(1, Math.min(49, Number(size) - 123));
}

export default function ThumbnailZoom({viewMode, size, onChange}) {
    const track = useRef(null), cleanup = useRef(null), callback = useRef(onChange);
    callback.current = onChange;
    const value = thumbnailZoomValue(viewMode, size);
    useEffect(() => () => cleanup.current?.(), []);
    const start = event => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); track.current.focus();
        cleanup.current?.();
        const rect = track.current.getBoundingClientRect();
        let last = thumbnailZoomState(value);
        const update = (pointer, persist) => {
            const step = Math.round(Math.max(0, Math.min(1, (pointer.clientX - rect.left) / Math.max(1, rect.width))) * 49);
            last = thumbnailZoomState(step);
            callback.current(last, persist);
        };
        const move = pointer => { pointer.preventDefault(); update(pointer, false); };
        const finish = pointer => { update(pointer, true); cleanup.current?.(); };
        const blur = () => { callback.current(last, true); cleanup.current?.(); };
        cleanup.current = () => {
            document.removeEventListener("mousemove", move, true);
            document.removeEventListener("mouseup", finish, true);
            window.removeEventListener("blur", blur);
            cleanup.current = null;
        };
        document.addEventListener("mousemove", move, true);
        document.addEventListener("mouseup", finish, true);
        window.addEventListener("blur", blur);
        update(event, false);
    };
    return <div className="photo-thumbnail-zoom">
        <span aria-hidden="true">−</span>
        <div ref={track} className="photo-thumbnail-zoom-track" role="slider" tabIndex={0}
            aria-label="Library zoom" aria-valuemin={0} aria-valuemax={49} aria-valuenow={value}
            aria-valuetext={viewMode === "list" ? "List view" : `Thumbnails ${size} pixels`}
            onMouseDown={start} onKeyDown={event => {
                const steps = {ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1, PageDown:-8, PageUp:8};
                if (!(event.key in steps) && !["Home", "End"].includes(event.key)) return;
                event.preventDefault(); event.stopPropagation();
                callback.current(thumbnailZoomState(event.key === "Home" ? 0 : event.key === "End" ? 49 : value + steps[event.key]), true);
            }}>
            <div className="photo-thumbnail-zoom-rail" />
            <div className="photo-thumbnail-zoom-fill" style={{width:`${value / 49 * 100}%`}} />
            <div className="photo-thumbnail-zoom-thumb" style={{left:`${value / 49 * 100}%`}} />
        </div>
        <span aria-hidden="true">+</span>
    </div>;
}
