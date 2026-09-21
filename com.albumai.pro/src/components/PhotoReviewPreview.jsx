import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PhotoImage from "./PhotoImage";
import {suspendLibraryReviewScrollbars} from "./PopupScrollbars";
import { photoReviewKey, bindPhotoReviewKeys, bindPhotoReviewPointerFocus, focusPhotoReviewViewport } from "./PhotoReviewKeyboard";
import { reviewPointer, reviewZoomStep, previewPanelSize, previewGeometry, previewResolution, clampPreviewPan, dragPreviewScale, previewImagePlacement, previewFilmstripWindow, previewClickScale, zoomPreviewAt, reviewPreviewGate } from "./PhotoPreviewModel";
import { CullingStatus } from "../services/PhotoCullingService";
import ImageSourceCapabilityService from "../services/ImageSourceCapabilityService";
import SoftwareJpegRenderer from "../services/SoftwareJpegRenderer";
import useReviewRendering from "./useReviewRendering";

const valueText = value => (typeof value === "string" || typeof value === "number") && value !== ""
    ? String(value) : "Unavailable";
const dateText = value => value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString() : "Unavailable";

function ReviewIcon({ kind }) {
    return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="none" stroke="#f4f6fa" strokeWidth="1.5" d={kind === "Zoom"
            ? "M11 11l5 5M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0"
            : kind === "Pan" ? "M5 10V4a1 1 0 0 1 2 0v4-6a1 1 0 0 1 2 0v6-5a1 1 0 0 1 2 0v5-3a1 1 0 0 1 2 0v5l-1 6H6l-4-6a1 1 0 0 1 2-1l1 1"
            : "M2 7V2h5M11 2h5v5M16 11v5h-5M7 16H2v-5"} />
    </svg>;
}

export default function PhotoReviewPreview({ photo, photos, index, count, selected, selectionOnly,
    decision, camera, eventLabel, onChangeDecision, onNavigate, onClose }) {
    const dialogRef = useRef(null);
    const closing = useRef(false);
    const closeTimer = useRef(null);
    const [presented, setPresented] = useState(false);
    const stageRef = useRef(null);
    const dragRef = useRef(null);
    const filmRef = useRef(null);
    const filmDrag = useRef(null);
    const filmMoved = useRef(false);
    const [filmOffset, setFilmOffset] = useState(0);
    const moved = useRef(false);
    const clickTimer = useRef(null);
    const clickLevel = useRef(0);
    const latest = useRef(null);
    const exifCache = useRef(new Map());
    // UXP does not expose window.innerWidth/innerHeight in every panel host.
    const measurePanel = () => {
        const rect = document.body.getBoundingClientRect();
        return previewPanelSize(rect.width, rect.height);
    };
    const [size, setSize] = useState(measurePanel);
    const [stage, setStage] = useState({ width: size.width - 260, height: size.height - 148 });
    const [view, setView] = useState(null);
    const { scale, offset } = view?.photoId === photo.id ? view : { scale: 1, offset: { x: 0, y: 0 } };
    const [mode, setMode] = useState("pan");
    const [shiftHeld, setShiftHeld] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [infoTab, setInfoTab] = useState("details");
    const [exif, setExif] = useState(null);
    const geometry = previewGeometry(exif?.photoId === photo.id ? {
        width: exif.width || photo.width, height: exif.height || photo.height } : photo, stage.width, stage.height);
    const imagePlacement = previewImagePlacement(geometry, scale, offset, stage);
    const profile = useReviewRendering(photo, geometry, scale);
    const strip = previewFilmstripWindow(count, index, stage.width, filmOffset);
    const scrollFilm = offset => {
        const next = previewFilmstripWindow(count, index, stage.width, offset).offset;
        latest.current.filmOffset = next;
        setFilmOffset(next);
    };
    const panActive = shiftHeld || mode === "pan";
    const rejected = decision.culling === CullingStatus.REJECT;
    const requestClose = () => {
        if (closing.current) return;
        closing.current = true;
        setPresented(false);
        closeTimer.current = setTimeout(() => latest.current.onClose(), 140);
    };
    const applyView = next => {
        Object.assign(latest.current, next);
        setView(Object.assign({ photoId: photo.id }, next));
    };
    const zoomTo = (next, anchor, base) => {
        clickLevel.current = 0;
        clearTimeout(clickTimer.current);
        applyView(zoomPreviewAt(latest.current, reviewZoomStep(next, 0), anchor, base));
    };
    latest.current = { onClose, requestClose, onNavigate, onChangeDecision, decision, rejected,
        scale, offset, geometry, stage, zoomTo, applyView, scrollFilm, filmOffset: strip.offset };
    const point = event => reviewPointer(event, stageRef.current.getBoundingClientRect());

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        const restoreScrollbars = suspendLibraryReviewScrollbars();
        document.body.classList.add("review-open");
        const focusInside = event => {
            if (!dialog.contains(event.target)) focusPhotoReviewViewport(dialog);
        };
        const keydown = event => {
            if (event.key === "Tab") {
                const controls = [...dialog.querySelectorAll('button:not([disabled]), [tabindex="0"]')];
                const position = controls.indexOf(document.activeElement);
                event.preventDefault();
                event.stopPropagation();
                controls[(position + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
                return;
            }
            if (event.key === "Shift") setShiftHeld(true);
            const key = photoReviewKey(event).toLowerCase();
            if ((event.defaultPrevented && key !== " " && key !== "escape") ||
                event.isComposing || event.altKey || event.metaKey || event.ctrlKey) return;
            const state = latest.current;
            if (!/^( |escape|arrow(left|right|up|down)|home|end|f|r|[+=0-5-])$/.test(key)) return;
            event.preventDefault();
            event.stopPropagation();
            if (closing.current) return;
            if (event.repeat && /^[ fr0-5]$/.test(key)) return;
            const navigation = { arrowleft: -1, arrowup: -1, arrowright: 1, arrowdown: 1, home: "first", end: "last" }[key];
            if (key === " " || key === "escape") state.requestClose();
            else if (navigation) state.onNavigate(navigation);
            else if (key === "f") state.onChangeDecision({ favorite: !state.decision.favorite });
            else if (key === "r") state.onChangeDecision({ culling: state.rejected ? CullingStatus.UNRATED : CullingStatus.REJECT });
            else if (/^[0-5]$/.test(key)) state.onChangeDecision({ rating: Number(key) });
            else state.zoomTo(reviewZoomStep(state.scale, key === "-" ? -0.25 : 0.25));
        };
        const keyup = event => { if (event.key === "Shift") setShiftHeld(false); };
        // In-panel modal avoids the operating-system title bar. Hide background
        // native widgets while open: UXP paints those above ordinary DOM layers.
        const releaseKeys = bindPhotoReviewKeys(keydown);
        const releasePointerFocus = bindPhotoReviewPointerFocus(dialog);
        const bindings = [[window, "keyup", keyup],
            [document, "focusin", focusInside]];
        bindings.forEach(([target, name, handler]) => target.addEventListener(name, handler, true));
        const enterTimer = setTimeout(() => { if (!closing.current) setPresented(true); }, 20);
        focusPhotoReviewViewport(dialog);
        const measure = () => {
            const next = measurePanel();
            setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next);
            const rect = stageRef.current?.getBoundingClientRect();
            if (rect?.width > 0 && rect?.height > 0) {
                setStage(previous => previous.width === rect.width && previous.height === rect.height
                    ? previous : { width: rect.width, height: rect.height });
            }
        };
        const initialMeasure = setTimeout(measure, 80);
        const measureTimer = setInterval(measure, 250);
        return () => {
            clearTimeout(enterTimer);
            clearTimeout(closeTimer.current);
            clearTimeout(initialMeasure);
            clearInterval(measureTimer);
            releasePointerFocus();
            releaseKeys();
            bindings.forEach(([target, name, handler]) => target.removeEventListener(name, handler, true));
            restoreScrollbars();
            document.body.classList.remove("review-open");
            reviewPreviewGate.release();
            focusPhotoReviewViewport(document.querySelector(".photo-browser-viewport"));
        };
    }, []);

    useEffect(() => {
        const left = index * 70, current = latest.current.filmOffset;
        if (left < current) scrollFilm(left);
        else if (left + 70 > current + stage.width) scrollFilm(left + 70 - stage.width);
    }, [index, stage.width]);

    useEffect(() => {
        dragRef.current = null;
        clickLevel.current = 0;
        setDragging(false);
        return () => clearTimeout(clickTimer.current);
    }, [photo.id]);

    useEffect(() => {
        let active = true;
        const cached = exifCache.current.get(photo.id);
        if (cached) { setExif(cached); return; }
        const timer = setTimeout(() => { if (SoftwareJpegRenderer.supports(photo)) {
            ImageSourceCapabilityService.readBinary(photo).then(binary => {
                if (!active) return;
                const facts = Object.assign({ photoId: photo.id }, SoftwareJpegRenderer.inspectMetadata(binary));
                exifCache.current.set(photo.id, facts);
                if (exifCache.current.size > 32) exifCache.current.delete(exifCache.current.keys().next().value);
                setExif(facts);
            }).catch(() => {});
        } }, 200);
        return () => { active = false; clearTimeout(timer); };
    }, [photo.id]);

    useEffect(() => {
        const move = event => {
            if (filmDrag.current) {
                event.preventDefault();
                const dx = event.clientX - filmDrag.current.x;
                if (Math.abs(dx) > 4) filmMoved.current = true;
                if (filmMoved.current) latest.current.scrollFilm(filmDrag.current.offset - dx);
                return;
            }
            const drag = dragRef.current;
            if (!drag) return;
            event.preventDefault();
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
            if (!moved.current) return;
            const state = latest.current;
            if (drag.mode === "zoom") {
                state.zoomTo(dragPreviewScale(drag.scale, dx, dy, state.geometry.maxScale, state.geometry.minScale), drag.anchor, drag);
            } else {
                state.applyView({ scale: state.scale, offset: clampPreviewPan({ x: drag.offset.x + dx, y: drag.offset.y + dy },
                    state.geometry, state.scale, state.stage) });
            }
        };
        const stop = () => { dragRef.current = null; filmDrag.current = null; setDragging(false); };
        const blur = () => { stop(); setShiftHeld(false); };
        const surface = stageRef.current;
        let gestureBase = null;
        let pinchUntil = 0;
        let lastGesture = null;
        const gesture = event => {
            // UXP may dispatch directly on a native element without traversing
            // window capture. Listen at both boundaries, applying each event once.
            if (event === lastGesture) return;
            lastGesture = event;
            pinchUntil = Date.now() + 300;
            event.preventDefault();
            event.stopPropagation();
            moved.current = true;
            clearTimeout(clickTimer.current);
            stop();
            const state = latest.current;
            if (event.type === "gesturestart") gestureBase = Object.assign({ anchor: point(event) }, state);
            else if (event.type === "gestureend") gestureBase = null;
            else if (Number.isFinite(event.scale) && event.scale > 0) {
                if (!gestureBase) gestureBase = Object.assign({ anchor: point(event) }, state);
                state.zoomTo(gestureBase.scale * event.scale, gestureBase.anchor, gestureBase);
            }
        };
        const wheel = event => {
            event.preventDefault();
            event.stopPropagation();
            const state = latest.current;
            if (gestureBase || Date.now() < pinchUntil) return;
            moved.current = true;
            clearTimeout(clickTimer.current);
            if (event.deltaY) state.zoomTo(reviewZoomStep(state.scale, event.deltaY > 0 ? -0.12 : 0.12), point(event));
        };
        const gestures = ["gesturestart", "gesturechange", "gestureend"];
        const gestureTargets = [surface, dialogRef.current, document, window];
        gestureTargets.forEach(target => gestures.forEach(name => target.addEventListener(name, gesture)));
        surface.addEventListener("wheel", wheel, { passive: false });
        const filmWheel = event => {
            event.preventDefault();
            event.stopPropagation();
            if (event.ctrlKey || event.metaKey) return;
            filmMoved.current = true;
            const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? -event.deltaX : event.deltaY;
            latest.current.scrollFilm(latest.current.filmOffset + delta * (event.deltaMode === 1 ? 16 : 1));
        };
        const film = filmRef.current;
        film.addEventListener("wheel", filmWheel, { passive: false });
        const bindings = [[document, "mousemove", move], [document, "mouseup", stop], [window, "blur", blur]];
        bindings.forEach(([target, name, handler]) => target.addEventListener(name, handler));
        return () => {
            gestureTargets.forEach(target => gestures.forEach(name => target.removeEventListener(name, gesture)));
            surface.removeEventListener("wheel", wheel);
            film.removeEventListener("wheel", filmWheel);
            bindings.forEach(([target, name, handler]) => target.removeEventListener(name, handler));
        };
    }, []);

    const metadata = Object.assign({}, photo.exif, photo.metadata, exif?.photoId === photo.id ? exif : null);
    const bytes = Number(photo.fileSize || photo.size || photo.file?.size);
    const fields = infoTab === "details" ? [
        ["Capture", dateText(photo.dateTaken || metadata.dateTaken)],
        ["Camera", `${camera?.tag || "—"} · ${valueText(photo.cameraModel || metadata.cameraModel)}`],
        ["Dimensions", photo.width && photo.height ? `${photo.width} × ${photo.height}` : "Unavailable"],
        ["File size", bytes ? `${(bytes / 1048576).toFixed(1)} MB` : "Unavailable"],
        ["Event", eventLabel || "Unassigned"],
        ["Selection", selected ? "Selected" : "Not selected"],
        ["Review", rejected ? "Rejected" : "Included"]
    ] : [
        ["Make", metadata.cameraMake || photo.cameraMake],
        ["Model", metadata.cameraModel || photo.cameraModel],
        ["Lens", metadata.lensModel || metadata.lens || photo.lens],
        ["Aperture", metadata.fNumber ? `f/${metadata.fNumber}` : metadata.aperture],
        ["Shutter", metadata.exposureTime ? (metadata.exposureTime < 1
            ? `1/${Math.round(1 / metadata.exposureTime)} s` : `${metadata.exposureTime} s`) : metadata.shutterSpeed],
        ["ISO", metadata.iso || metadata.isoSpeedRatings],
        ["Focal length", metadata.focalLength ? `${metadata.focalLength} mm` : null]
    ];
    return createPortal(
        <div className={`review-overlay${presented ? " is-presented" : ""}`}
            onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={1} aria-label="Photo preview"
                className="review-shell review-modal" style={{ width: size.width, height: size.height }}>
                <header className="review-header">
                    <span className="review-title" title={photo.name}>{photo.name || "Photo preview"}</span>
                    <span className="review-counter">{index + 1} / {count} · {selectionOnly ? "Selected photos" : "Library"}</span>
                    <button type="button" onClick={requestClose} title="Space / Esc">Close</button>
                </header>
                <div className="review-body">
                    <div className="review-canvas">
                        <div ref={stageRef} className={`review-stage${panActive ? (dragging ? " is-panning" : " is-pan-ready") : ""}`}
                            onMouseMove={event => setShiftHeld(!!event.shiftKey)}
                            onMouseDown={event => {
                                if (event.target.closest?.("button, [role=button]")) return;
                                if (event.button != null && event.button !== 0) return;
                                event.preventDefault();
                                moved.current = false;
                                setShiftHeld(!!event.shiftKey);
                                setDragging(true);
                                dragRef.current = { x: event.clientX, y: event.clientY, scale,
                                    offset, anchor: point(event), mode: event.shiftKey ? "pan" : mode };
                            }}
                            onDoubleClick={event => { if (!event.target.closest?.("button, [role=button]")) zoomTo(1); }}
                            onClick={event => {
                                if (mode === "pan" || moved.current || event.shiftKey || event.target.closest?.("button, [role=button]")) return;
                                if (event.detail > 1) { zoomTo(1); return; }
                                const anchor = point(event);
                                clearTimeout(clickTimer.current);
                                clickTimer.current = setTimeout(() => {
                                    const step = clickLevel.current;
                                    const state = latest.current;
                                    state.zoomTo(previewClickScale(step, state.geometry), anchor);
                                    clickLevel.current = (step + 1) % 4;
                                }, 250);
                            }}>
                            <div style={Object.assign({ position: "absolute", pointerEvents: "none" }, imagePlacement)}>
                            <PhotoImage key={photo.id} photo={photo}
                                profile={profile}
                                initialProfile="preview" requestDelay={80} priority={0} alt={photo.name}
                                fallback={status => status === "error" ? "Unavailable" : "Loading…"}
                                style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
                            </div>
                            {[-1, 1].map(direction => <div key={direction} role="button" tabIndex={0}
                                className={`review-nav ${direction < 0 ? "review-back" : "review-next"}`}
                                title={direction < 0 ? "Previous photo" : "Next photo"}
                                onKeyDown={event => { if (event.key === "Enter") onNavigate(direction); }}
                                onClick={() => onNavigate(direction)}>{direction < 0 ? "‹" : "›"}</div>)}
                        <div className="review-tools" role="toolbar" aria-label="Preview tools">
                            {[
                                ["Zoom", () => setMode("zoom"), !panActive],
                                ["Pan", () => setMode("pan"), panActive],
                                ["−", () => zoomTo(reviewZoomStep(scale, -0.25))],
                                ["+", () => zoomTo(reviewZoomStep(scale, 0.25))],
                                ["Fit", () => zoomTo(1)]
                            ].map(([label, action, pressed]) => <div key={label} role="button" tabIndex={0}
                                title={label} aria-label={label} aria-pressed={pressed} onClick={action}
                                onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); action(); } }}>
                                {label.length > 1 ? <ReviewIcon kind={label} /> : label}</div>)}
                            <span>{Number(scale.toFixed(2))}×</span>
                        </div>
                        </div>
                        <div ref={filmRef} className="review-filmstrip" aria-label="Preview thumbnails"
                            onMouseDown={event => {
                                if (event.button != null && event.button !== 0) return;
                                event.preventDefault();
                                filmMoved.current = false;
                                filmDrag.current = { x: event.clientX, offset: strip.offset };
                            }}>
                            <div className="review-thumbnails" style={{ left: strip.left }}>
                                {photos.slice(strip.start, strip.end).map((item, offsetIndex) => {
                                    const photoIndex = strip.start + offsetIndex;
                                    return <div role="button" tabIndex={0} key={item.id} className="review-thumbnail"
                                        title={item.name} aria-label={`Preview ${item.name}`}
                                        onKeyDown={event => { if (event.key === "Enter") onNavigate(photoIndex - index); }}
                                        aria-pressed={photoIndex === index}
                                        style={{ borderColor: photoIndex === index ? "#8dc3ff" : "transparent" }}
                                        onClick={() => { if (!filmMoved.current) onNavigate(photoIndex - index); }}>
                                        <div className="review-thumb-image"><PhotoImage photo={item}
                                            priority={1} requestDelay={120} alt={item.name} fallback="…"
                                            style={{ width: "100%", height: "100%", objectFit: "cover",
                                                opacity: photoIndex === index ? 1 : 0.35 }} /></div>
                                        {photoIndex !== index && <div className="review-thumb-shade" />}
                                    </div>;
                                })}
                            </div>
                        </div>
                    </div>
                    <aside className="review-inspector">
                        <div className="review-tabs">
                            {["Details", "EXIF"].map(label => <button key={label} type="button"
                                aria-pressed={infoTab === label.toLowerCase()} onClick={() => setInfoTab(label.toLowerCase())}>{label}</button>)}
                        </div>
                        <div className="review-metadata">
                            {fields.map(([label, value]) => <div key={label} className="review-field">
                                <small>{label}</small><span title={valueText(value)}>{valueText(value)}</span>
                            </div>)}
                        </div>
                        <div className="review-decisions">
                            <small>Rating · 0–5</small>
                            <div className="review-stars">
                                {[1, 2, 3, 4, 5].map(rating => <button key={rating} type="button"
                                    aria-label={`${rating} stars`} aria-pressed={decision.rating >= rating}
                                    onClick={() => onChangeDecision({ rating: decision.rating === rating ? 0 : rating })}>
                                    {decision.rating >= rating ? "★" : "☆"}
                                </button>)}
                            </div>
                            <div className="review-flags">
                                {[[`${decision.favorite ? "♥" : "♡"} Favorite`, !!decision.favorite, { favorite: !decision.favorite }],
                                    [rejected ? "Unreject" : "Reject", rejected, { culling: rejected ? CullingStatus.UNRATED : CullingStatus.REJECT }]
                                ].map(([label, pressed, change]) => <button key={label} type="button" aria-pressed={pressed}
                                    onClick={() => onChangeDecision(change)}>{label}</button>)}
                            </div>
                        </div>
                    </aside>
                </div>
                <footer className="review-footer">Wheel: zoom · Drag: pan · Double-click: Fit · Space: close</footer>
            </div>
        </div>, document.body
    );
}
