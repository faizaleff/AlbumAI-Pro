import {bindSpreadDrag, transferSpreadPhoto} from "./spreadDrag";
import { normalizePhotoPosition } from "../project/AlbumSheetSchema";
import { PsdPreviews } from "../services/TemplateDocumentReader";
import React, { useEffect, useRef, useState } from "react";
import PhotoImage from "./PhotoImage";
import SidebarButton from "./SidebarButton";
import UxpDropdown from "./UxpDropdown";
import SheetStoryboardStrip from "./SheetStoryboardStrip";

const CROP_FOCUS_OPTIONS = ["center", "top", "bottom", "left", "right"];

function SlotCard({
    slot,
    assignedPhoto,
    cropFocus = "center",
    selectedPhoto,
    onAssign,
    onUnassign,
    onSetCropFocus,
    swapSourceSlotId,
    onStartSwap,
    onCancelSwap,
    disabled
}) {
    const slotId = slot?.layerId ?? slot?.id ?? slot?.slotId;
    const slotName = slot?.layerName ?? slot?.name ?? slot?.slotName ?? `Slot ${slotId}`;
    const isSwapSource = swapSourceSlotId != null && String(swapSourceSlotId) === String(slotId);

    const handleAssignSelected = () => {
        if (selectedPhoto?.id && !disabled) {
            onAssign(slotId, selectedPhoto.id);
        }
    };

    const cycleCropFocus = () => {
        if (disabled) return;
        const currentIndex = CROP_FOCUS_OPTIONS.indexOf(cropFocus);
        const nextIndex = (currentIndex + 1) % CROP_FOCUS_OPTIONS.length;
        onSetCropFocus(slotId, CROP_FOCUS_OPTIONS[nextIndex]);
    };

    const faceCount = assignedPhoto?.faces?.length || assignedPhoto?.aiAnalysis?.faces?.length || 0;

    return (
        <div
            className={`spread-slot-card${isSwapSource ? " is-swap-source" : ""}${assignedPhoto ? " has-photo" : " is-empty"}`}
        >
            <div className="spread-slot-header">
                <div className="spread-slot-title-group">
                    <span className="spread-slot-name" title={slotName}>{slotName}</span>
                    {faceCount > 0 && (
                        <span className="spread-slot-face-badge" title={`${faceCount} face${faceCount > 1 ? "s" : ""} detected`}>
                            👤 {faceCount}
                        </span>
                    )}
                </div>
                {assignedPhoto && (
                    <button
                        type="button"
                        className="spread-slot-crop-btn"
                        onClick={cycleCropFocus}
                        disabled={disabled}
                        title={`Crop focus: ${cropFocus}. Click to cycle.`}
                    >
                        Crop: {cropFocus}
                    </button>
                )}
            </div>

            <div className="spread-slot-preview-box">
                {assignedPhoto ? (
                    <div className={`spread-slot-image-wrapper crop-focus-${cropFocus}`}>
                        <PhotoImage photo={assignedPhoto} size={180} />
                    </div>
                ) : (
                    <div className="spread-slot-placeholder">
                        <span className="placeholder-icon">📷</span>
                        <span className="placeholder-text">Drop photo here</span>
                        <button
                            type="button"
                            className="spread-slot-assign-btn"
                            onClick={handleAssignSelected}
                            disabled={disabled || !selectedPhoto?.id}
                            title={selectedPhoto?.id
                                ? `Assign ${selectedPhoto.name || "selected photo"} to ${slotName}`
                                : "Select a photo in Library to assign it to this slot"}
                        >
                            + Assign {selectedPhoto?.name ? `(${selectedPhoto.name})` : "Selected"}
                        </button>
                    </div>
                )}
            </div>

            <div className="spread-slot-footer">
                {assignedPhoto ? (
                    <>
                        <span className="spread-slot-photo-name" title={assignedPhoto.name}>
                            {assignedPhoto.name}
                        </span>
                        <div className="spread-slot-actions">
                            {swapSourceSlotId == null ? (
                                <button
                                    type="button"
                                    className="spread-slot-action-btn"
                                    onClick={() => onStartSwap(slotId)}
                                    disabled={disabled}
                                    title="Swap photo with another slot"
                                >
                                    ⇄ Swap
                                </button>
                            ) : isSwapSource ? (
                                <button
                                    type="button"
                                    className="spread-slot-action-btn active"
                                    onClick={onCancelSwap}
                                    title="Cancel swap"
                                >
                                    Cancel
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="spread-slot-action-btn active"
                                    onClick={() => onStartSwap(slotId)}
                                    disabled={disabled}
                                    title="Swap with this slot"
                                >
                                    ⇄ Swap Here
                                </button>
                            )}
                            <button
                                type="button"
                                className="spread-slot-action-btn danger"
                                onClick={() => onUnassign(slotId)}
                                disabled={disabled}
                                title="Clear photo from slot"
                            >
                                ✕
                            </button>
                        </div>
                    </>
                ) : (
                    <span className="spread-slot-status-empty">Empty slot</span>
                )}
            </div>
        </div>
    );
}

export default function SpreadCanvas({
    sheet,
    template,
    photos = [],
    selectedPhoto = null,
    onAssignSlot,
    onUnassignSlot,
    onSwapSlots,
    onSetSlotCrop,
    onRenderSheet,
    renderBusy = false,
    disabled = false
}) {
    const [swapSourceSlotId, setSwapSourceSlotId] = useState(null);

    if (!sheet) {
        return (
            <div className="spread-canvas-empty">
                <p>Select an Album Sheet from the storyboard below to design its spread.</p>
            </div>
        );
    }

    let smartObjects = (Array.isArray(template?.smartObjects) && template.smartObjects.length > 0)
        ? template.smartObjects.filter(slot => slot?.layerId != null)
        : [];

    if (smartObjects.length === 0) {
        if (template?.fileName === "01.psd" || template?.name === "01.psd" || template?.slotCount === 2) {
            smartObjects = [
                { layerId: 2, layerName: "Slot 2" },
                { layerId: 4, layerName: "Slot 4" }
            ];
        } else if (template?.fileName === "02.psd" || template?.name === "02.psd" || template?.slotCount === 1) {
            smartObjects = [
                { layerId: 2, layerName: "Slot 2" }
            ];
        }
    }

    const assignedSlots = Array.isArray(sheet.slots) ? sheet.slots : [];
    const photoById = new Map((photos || []).map(p => [String(p.id), p]));

    // Slot list is strictly derived from canonical registered template smartObjects,
    // or from existing assigned slots if template descriptor is unavailable.
    // Synthetic slot IDs are NEVER invented.
    let slotList = [];
    if (smartObjects.length > 0) {
        slotList = smartObjects.map(so => ({
            layerId: so.layerId,
            layerName: so.layerName || `Slot ${so.layerId}`
        }));
    } else if (assignedSlots.length > 0) {
        slotList = assignedSlots.map(s => ({
            layerId: s.slotId,
            layerName: `Slot ${s.slotId}`
        }));
    }

    const totalSlotsCount = smartObjects.length > 0
        ? smartObjects.length
        : (Number.isInteger(template?.slotCount) && template.slotCount > 0
            ? template.slotCount
            : (assignedSlots.length || 0));

    const handleStartOrCompleteSwap = (targetSlotId) => {
        if (swapSourceSlotId == null) {
            setSwapSourceSlotId(targetSlotId);
        } else if (String(swapSourceSlotId) !== String(targetSlotId)) {
            onSwapSlots(sheet.id, swapSourceSlotId, targetSlotId);
            setSwapSourceSlotId(null);
        } else {
            setSwapSourceSlotId(null);
        }
    };

    const filledCount = slotList.filter(slot => {
        const slotId = slot?.layerId ?? slot?.id ?? slot?.slotId;
        return assignedSlots.some(s => String(s.slotId) === String(slotId));
    }).length;

    return (
        <section className="spread-canvas-container" aria-label="Spread Canvas Designer">
            <div className="spread-canvas-header">
                <div className="spread-canvas-meta">
                    <h3 className="spread-sheet-title">{sheet.label || sheet.id}</h3>
                    <span className="spread-template-badge">{template?.name || sheet.templateId}</span>
                    <span className="spread-fill-badge">
                        {filledCount} / {totalSlotsCount || slotList.length} slots assigned
                    </span>
                </div>

                {onRenderSheet && (
                    <button
                        type="button"
                        className="spread-render-btn"
                        onClick={() => onRenderSheet(sheet.id)}
                        disabled={disabled || renderBusy || !slotList.length}
                        title="Render this spread in Photoshop"
                    >
                        {renderBusy ? "Rendering…" : "⚡ Render Spread"}
                    </button>
                )}
            </div>

            {slotList.length === 0 ? (
                <div className="spread-canvas-no-slots">
                    <p>No Smart Object photo slots detected for template: <strong>{template?.name || sheet.templateId}</strong>.</p>
                </div>
            ) : (
                <div className="spread-slots-grid">
                    {slotList.map((slot) => {
                        const slotId = slot?.layerId ?? slot?.id ?? slot?.slotId;
                        const assignment = assignedSlots.find(s => String(s.slotId) === String(slotId));
                        const assignedPhoto = assignment ? photoById.get(String(assignment.photoId)) : null;

                        return (
                            <SlotCard
                                key={slotId}
                                slot={slot}
                                assignedPhoto={assignedPhoto}
                                cropFocus={assignment?.cropFocus || "center"}
                                selectedPhoto={selectedPhoto}
                                onAssign={(sId, pId) => onAssignSlot(sheet.id, sId, pId)}
                                onUnassign={(sId) => onUnassignSlot(sheet.id, sId)}
                                onSetCropFocus={(sId, focus) => onSetSlotCrop(sheet.id, sId, focus)}
                                swapSourceSlotId={swapSourceSlotId}
                                onStartSwap={handleStartOrCompleteSwap}
                                onCancelSwap={() => setSwapSourceSlotId(null)}
                                disabled={disabled}
                            />
                        );
                    })}
                </div>
            )}
        </section>
    );
}


// The registry records slot identities, not PSD geometry. This overview must
// never invent layer IDs or imply that its arrangement reproduces the PSD.
export function designSlotOverview(sheet, template) {
    const assignments = sheet?.slots || [];
    const slots = template?.smartObjects?.filter(slot => slot?.layerId != null) || [];
    return (slots.length ? slots : assignments.map(slot => ({layerId: slot.slotId})))
        .map(slot => ({...slot, assignment: assignments.find(item => String(item.slotId) === String(slot.layerId))}));
}

export function filterDesignPhotos(photos, sheets, query = "", unused = false) {
    const placed = new Set((sheets || []).flatMap(sheet => (sheet.slots || []).map(slot => String(slot.photoId))));
    return photos.filter(photo => (!unused || !placed.has(String(photo.id))) &&
        String(photo.name || photo.id).toLowerCase().includes(query.trim().toLowerCase()));
}

// Match the fill/anchor math used by Photoshop without rendering on every gesture.
export function draftPhotoFrame(slot, photo, region, aspect, delta = {}) {
    const position = normalizePhotoPosition(slot?.position);
    const ratio = (Number(photo?.width || photo?.metadata?.width) / Number(photo?.height || photo?.metadata?.height)) / (region.width * aspect / region.height);
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const width = Math.max(1, ratio) * position.zoom, height = Math.max(1, 1 / ratio) * position.zoom;
    const focus = slot.cropFocus || "center";
    const anchorX = focus === "left" ? 0 : focus === "right" ? 1 - width : (1 - width) / 2;
    const anchorY = focus === "top" ? 0 : focus === "bottom" ? 1 - height : (1 - height) / 2;
    const x = Math.max(1 - width, Math.min(0, anchorX + position.x + (delta.x || 0)));
    const y = Math.max(1 - height, Math.min(0, anchorY + position.y + (delta.y || 0)));
    return {x, y, width, height, position: {...position, x: x - anchorX, y: y - anchorY}};
}

// Keep the visible centre fixed when zooming, including top-anchored brush slots.
export function zoomPhotoPosition(slot, photo, region, aspect, delta) {
    const previous = normalizePhotoPosition(slot.position);
    const candidate = normalizePhotoPosition({...previous, zoom: previous.zoom + delta});
    const before = draftPhotoFrame(slot, photo, region, aspect);
    const after = draftPhotoFrame({...slot, position: candidate}, photo, region, aspect);
    if (!before || !after) return candidate;
    const scale = candidate.zoom / previous.zoom;
    return draftPhotoFrame({...slot, position: candidate}, photo, region, aspect, {
        x: .5 - (.5 - before.x) * scale - after.x,
        y: .5 - (.5 - before.y) * scale - after.y
    }).position;
}

export function editPreviewSlots(slots, id, change, target) {
    if (target != null && !slots.some(slot => String(slot.slotId) === String(id))) return slots;
    if (target != null && !slots.some(slot => String(slot.slotId) === String(target))) {
        return slots.map(slot => String(slot.slotId) === String(id) ? {...slot, slotId: target} : slot);
    }
    if (target != null) return slots.map(slot => String(slot.slotId) === String(id)
        ? {...slots.find(item => String(item.slotId) === String(target)), slotId: slot.slotId}
        : String(slot.slotId) === String(target) ? {...slots.find(item => String(item.slotId) === String(id)), slotId: slot.slotId} : slot);
    return slots.map(slot => String(slot.slotId) === String(id) ? {...slot, ...change} : slot);
}

// Same-slot drag pans; another occupied slot swaps. Wheel changes only the hovered photo.
export function bindPreviewSwap(root, {valid, onSwap, onPan, onLive = () => {}, onZoom = () => {}, mode = "auto", dragEnabled = true}, doc = document, host = window) {
    let start = null, dragging = false, suppressClick = false, disposed = false;
    let wheelFrame = null, wheelSlot = null, wheelDelta = 0;
    const requestFrame = typeof host.requestAnimationFrame === "function"
        ? callback => host.requestAnimationFrame(callback) : callback => setTimeout(callback, 0);
    const cancelFrame = typeof host.cancelAnimationFrame === "function"
        ? id => host.cancelAnimationFrame(id) : id => clearTimeout(id);
    const available = () => !disposed && valid();
    const nodes = () => Array.from(root.querySelectorAll("[data-preview-slot]"));
    const hit = event => {
        const all = nodes();
        const direct = event.target?.closest?.("[data-preview-slot]");
        if (direct && all.includes(direct) && direct.getAttribute("aria-disabled") !== "true") {
            const r = direct.getBoundingClientRect();
            if (event.clientX >= r.left && event.clientX < r.right && event.clientY >= r.top && event.clientY < r.bottom) return direct;
        }
        const matches = nodes().filter(node => {
            if (node.getAttribute("aria-disabled") === "true") return false;
            const r = node.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && event.clientX >= r.left && event.clientX < r.right &&
                event.clientY >= r.top && event.clientY < r.bottom;
        });
        // Border rounding can make adjacent UXP hit areas overlap by a pixel.
        // Prefer the smallest visible region instead of cancelling the gesture.
        return matches.sort((a, b) => {
            const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
            return ar.width * ar.height - br.width * br.height;
        })[0] || null;
    };
    const canPan = node => node?.getAttribute("data-pan-supported") !== "false";
    const clear = () => {
        nodes().forEach(node => node.removeAttribute("data-swap-state"));
        start = null; dragging = false; onLive(null);
    };
    const flushWheel = () => {
        wheelFrame = null;
        const id = wheelSlot, delta = wheelDelta;
        wheelSlot = null; wheelDelta = 0;
        if (id != null && delta && available()) onZoom(id, delta);
    };
    const cancelWheel = () => {
        if (wheelFrame != null) cancelFrame(wheelFrame);
        wheelFrame = null; wheelSlot = null; wheelDelta = 0;
    };
    const down = event => {
        if (!dragEnabled) return;
        cancelWheel(); clear(); suppressClick = false;
        if ((event.button != null && event.button !== 0) || !available()) return;
        const node = hit(event);
        // Keep an ordinary click intact so the slot selects and Change photo
        // remains usable. Native behavior is suppressed only after a drag has
        // crossed the movement threshold in move().
        if (node) start = {node, x: event.clientX, y: event.clientY};
    };
    const move = event => {
        if (!start) return;
        // UXP can report buttons=0 while the mouse is held. Mouseup, Escape
        // and window blur own cancellation, not this unreliable bitmask.
        if (!available()) { cancelWheel(); clear(); return; }
        if (!dragging && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
        dragging = true; suppressClick = true; event.preventDefault();
        const target = hit(event), r = start.node.getBoundingClientRect();
        nodes().forEach(node => node.removeAttribute("data-swap-state"));
        start.node.setAttribute("data-swap-state", "source");
        if (mode !== "move" && target && target !== start.node) target.setAttribute("data-swap-state", "target");
        onLive(target === start.node && mode !== "swap" && canPan(start.node) ? {id: start.node.getAttribute("data-preview-slot"),
            x: (event.clientX - start.x) / r.width, y: (event.clientY - start.y) / r.height} : null);
    };
    const up = event => {
        if (!start) return;
        const target = hit(event), source = start.node, r = source.getBoundingClientRect();
        const dx = (event.clientX - start.x) / r.width, dy = (event.clientY - start.y) / r.height;
        const commit = dragging && (event.button == null || event.button === 0) && target && available();
        if (commit) {
            if (target === source && mode !== "swap" && canPan(source)) onPan(source.getAttribute("data-preview-slot"), dx, dy);
            else if (target !== source && mode !== "move") onSwap(source.getAttribute("data-preview-slot"), target.getAttribute("data-preview-slot"));
        }
        clear();
    };
    const wheel = event => {
        const delta = Number.isFinite(event.deltaY) && event.deltaY !== 0 ? event.deltaY : -Number(event.wheelDelta);
        if (start || !available() || !Number.isFinite(delta) || !delta) return;
        const node = hit(event); if (!node) return;
        event.preventDefault(); event.stopPropagation();
        if (!canPan(node)) return;
        const id = node.getAttribute("data-preview-slot");
        if (wheelSlot != null && String(wheelSlot) !== String(id)) flushWheel();
        wheelSlot = id;
        wheelDelta = Math.max(-.25, Math.min(.25,
            Math.round((wheelDelta + (delta < 0 ? .05 : -.05)) * 100) / 100));
        if (wheelFrame == null) wheelFrame = requestFrame(flushWheel);
    };
    const cancelInteraction = () => { cancelWheel(); clear(); };
    const scroll = event => { if (root.contains?.(event.target)) cancelInteraction(); };
    const nativeDrag = event => { if (start) event.preventDefault(); };
    const key = event => { if (event.key === "Escape") cancelInteraction(); };
    const click = event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); } };
    const bindings = [[root, "mousedown", down], [doc, "mousemove", move], [doc, "mouseup", up],
        [root, "dragstart", nativeDrag], [doc, "keydown", key], [doc, "scroll", scroll], [host, "blur", cancelInteraction], [host, "resize", cancelInteraction], [root, "click", click], [root, "wheel", wheel], [root, "mousewheel", wheel]];
    bindings.forEach(([node, type, fn]) => node.addEventListener(type, fn, {capture: true, passive: false}));
    return () => { disposed = true; cancelWheel(); clear(); bindings.forEach(([node, type, fn]) => node.removeEventListener(type, fn, true)); };
}

export function bindAssetDrop(root, {valid, onDrop}, doc = document) {
    let start = null, moved = false, suppress = false;
    const targets = () => Array.from(root.querySelectorAll("[data-drop-slot]"));
    const hit = event => targets().filter(node => {
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && event.clientX >= r.left && event.clientX < r.right && event.clientY >= r.top && event.clientY < r.bottom;
    })[0];
    const clear = () => { targets().forEach(node => node.removeAttribute("data-asset-target")); start = null; moved = false; };
    const down = event => {
        clear(); suppress = false;
        const source = event.target?.closest?.("[data-asset-photo]");
        if (!valid() || !source || (event.button != null && event.button !== 0)) return;
        start = {id: source.getAttribute("data-asset-photo"), x: event.clientX, y: event.clientY};
    };
    const move = event => {
        if (!start) return;
        if (!valid()) { clear(); return; }
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
        moved = true; suppress = true; event.preventDefault();
        const target = hit(event);
        targets().forEach(node => node.removeAttribute("data-asset-target"));
        target?.setAttribute("data-asset-target", "true");
    };
    const up = event => {
        if (!start) return;
        const target = hit(event);
        if (moved && valid() && (event.button == null || event.button === 0)) {
            const canvas = root.querySelector(".design-canvas-scroll")?.getBoundingClientRect();
            const inside = canvas && event.clientX >= canvas.left && event.clientX < canvas.right && event.clientY >= canvas.top && event.clientY < canvas.bottom;
            if (target || inside) onDrop(start.id, target?.getAttribute("data-drop-slot") ?? null);
        }
        clear();
    };
    const click = event => { if (suppress) { event.preventDefault(); event.stopPropagation(); suppress = false; } };
    const key = event => { if (event.key === "Escape") clear(); };
    const bindings = [[root, "mousedown", down], [doc, "mousemove", move], [doc, "mouseup", up], [root, "click", click], [doc, "keydown", key]];
    bindings.forEach(([node, type, fn]) => node.addEventListener(type, fn, true));
    return () => { clear(); bindings.forEach(([node, type, fn]) => node.removeEventListener(type, fn, true)); };
}

function InteractiveSpreadPreview({preview, previewKey, sheet, base, photos, selectedSlotId, disabled, onSwap, onSelect, onPan, onZoom, live: workspaceLive, readOnly = false}) {
    const root = useRef(null), current = useRef(null);
    const [live, setLive] = useState(null);
    useEffect(() => {
        if (readOnly || !root.current) return;
        const element = root.current;
        // Measure the fixed viewport, never the image: fitting must not resize its own parent.
        let previous = "";
        const fit = () => {
            const box = element.parentElement.getBoundingClientRect();
            const aspect = Number(preview.aspect) || 1;
            const width = Math.max(0, Math.floor(Math.min(box.width, box.height * aspect)));
            const height = Math.max(0, Math.floor(width / aspect));
            const size = width + ":" + height;
            if (size === previous) return;
            previous = size;
            element.style.width = width + "px";
            element.style.height = height + "px";
        };
        fit();
        window.addEventListener("resize", fit);
        // UXP panel/sidebar resizing does not always dispatch a window resize event.
        const timer = setInterval(fit, 150);
        return () => { clearInterval(timer); window.removeEventListener("resize", fit); };
    }, [readOnly, preview.aspect]);
    current.current = {disabled, previewKey, onSwap, onPan, onZoom};
    useEffect(() => {
        if (!root.current || disabled || readOnly) return;
        let active = true;
        const cleanup = bindPreviewSwap(root.current, {
            dragEnabled: false,
            valid: () => active && !current.current.disabled && current.current.previewKey === previewKey,
            onLive: setLive, onZoom: (id, delta) => current.current.onZoom(id, delta),
            onPan: (id, x, y) => current.current.onPan(id, x, y),
            onSwap: (a, b) => current.current.onSwap(sheet.id, a, b)
        });
        return () => { active = false; cleanup(); };
    }, [preview, previewKey, disabled, sheet.id, readOnly]);
    const Hit = readOnly ? "div" : SidebarButton;
    return <div className={"design-preview-image" + (readOnly ? " design-preview-mini" : "")} ref={root}>
        <img src={preview.src} alt="Rendered spread preview" draggable={false}/>
        {(preview.regions || []).map(region => {
            const slot = (sheet.slots || []).find(item => String(item.slotId) === String(region.id));
            const photo = photos.find(item => String(item.id) === String(slot?.photoId));

            const initial = (preview.template ? [] : base.slots || []).find(item => String(item.slotId) === String(region.id));
            const gesture = workspaceLive || live;
            const moving = String(gesture?.id) === String(region.id);
            const frame = region.supported === false ? null : draftPhotoFrame(slot, photo, region, preview.aspect, moving ? gesture : {});
            const changed = moving || JSON.stringify(slot) !== JSON.stringify(initial);
            return <Hit key={region.id} className="design-preview-hit" data-preview-slot={region.id}
                data-drop-slot={region.id} data-pan-supported={photo && frame ? "true" : "false"}
                aria-pressed={String(selectedSlotId) === String(region.id)}
                disabled={disabled} aria-label={"Select photo slot " + region.id}
                title="Drag to move · Drop to swap · Scroll to zoom" onClick={() => onSelect(region.id)}
                style={{left: region.x * 100 + "%", top: region.y * 100 + "%",
                    width: region.width * 100 + "%", height: region.height * 100 + "%"}}>
                {!photo && changed && <div className="design-draft-empty"/>}
                {photo && frame && <div className="design-draft-photo" style={{visibility: changed ? "visible" : "hidden", left: frame.x * 100 + "%", top: frame.y * 100 + "%",
                    width: frame.width * 100 + "%", height: frame.height * 100 + "%"}}>
                    <PhotoImage key={photo.id} photo={photo} profile="thumbnail" role="design-draft"
                        style={{width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none",
                            transform: `scale(${region.flipX ? -1 : 1}, ${region.flipY ? -1 : 1})`}}/>
                </div>}
                {region.coverSrc && <img src={region.coverSrc} className="design-draft-shape-cover" draggable={false}
                    style={{visibility: changed ? "visible" : "hidden"}} alt=""/>}
            </Hit>;
        })}
    </div>;
}

export function DesignWorkspace({
    drafts = {}, onDraftChange, onDraftBatchChange, onDesignUndo, onDesignRedo, canDesignUndo, canDesignRedo, onApplyDraft, onApplyAllDrafts,
    projectId, onPreviewTemplate, onCancelPreview, templatePreviewLoadingId,
    sheets = [], sheet, template, templates = [], photos = [], allPhotos = photos,
    selectedPhotoId, onSelectPhoto, templateId, onSelectTemplate, templateTools,
    typographyTargetRef, onSelectSheet, onAddSheet, onMoveSheet, onDuplicateSheet,
    onRemoveSheet, onRenameSheet, onArrange, onExport, onAssignSlot,
    onUnassignSlot, onSwapSlots, onPreviewSwap, onSetSlotCrop, onRenderSheet,
    disabled = false, renderBusy = false, error,
    ImageComponent = PhotoImage
}) {
    const workspaceRoot = useRef(null), dropHandler = useRef(null);
    const dragState = useRef(null);
    const [removeId, setRemoveId] = useState(null);
    const [dragLive, setDragLive] = useState(null);
    useEffect(() => bindSpreadDrag(workspaceRoot.current, () => dragState.current), []);
    const effectiveSlots = id => drafts[id]?.slots || sheets.find(item => item.id === id)?.slots || [];
    dragState.current = {
        disabled: disabled || renderBusy || !!removeId, sheetId: sheet?.id,
        canTransfer: (id, slot) => effectiveSlots(id).some(item => String(item.slotId) === String(slot)),
        select: id => {const target = sheets.find(item => item.id === id); if (target) onSelectSheet(target);},
        reorder: (id, target) => {if (id !== target) onMoveSheet(id, sheets.findIndex(item => item.id === target));},
        transfer: (from, fromSlot, to, toSlot) => {
            const source = sheets.find(item => item.id === from), target = sheets.find(item => item.id === to);
            if (!source || !target || !onDraftBatchChange) return;
            const changes = transferSpreadPhoto(effectiveSlots(from), effectiveSlots(to), fromSlot, toSlot);
            if (!changes) return;
            const next = {};
            for (const [item, slots] of [[source, changes.source], [target, changes.target]]) {
                const old = drafts[item.id];
                if (old && JSON.stringify(old.base) !== JSON.stringify(item)) return;
                const t = templates.find(t => t.id === item.templateId);
                const preview = old?.preview || PsdPreviews.resolve(projectId,item,t,allPhotos).image || PsdPreviews.get(PsdPreviews.key(projectId,null,t));
                next[item.id] = {base: old?.base || item, slots, preview};
            }
            onDraftBatchChange(next);
        }
    };
    useEffect(() => bindAssetDrop(workspaceRoot.current, {valid: () => !!dropHandler.current, onDrop: (photo, slot) => dropHandler.current?.(photo, slot)}), []);
    const [tab, setTab] = useState("photos");
    const [showSlots, setShowSlots] = useState(false);
    const [query, setQuery] = useState("");
    const [unused, setUnused] = useState(false);
    const [selectedSlotId, setSelectedSlotId] = useState(null);
    const [swapId, setSwapId] = useState(null);
    const [replaceSlotId, setReplaceSlotId] = useState(null);
    const [name, setName] = useState(sheet?.label || sheet?.id || "");
    const [inspector, setInspector] = useState("spread");
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    const [page, setPage] = useState(0);
    useEffect(() => {
        setSelectedSlotId(null); setSwapId(null); setReplaceSlotId(null); setInspector("spread");
        setName(sheet?.label || sheet?.id || "");
    }, [sheet?.id, sheet?.label, sheet?.templateId]);
    useEffect(() => { setPage(0); }, [query, unused, photos.map(photo => photo.id).join("\n")]);
    const resolvedPreview = PsdPreviews.resolve(projectId, sheet, template, allPhotos);
    const previewKey = resolvedPreview.key;
    const draft = drafts[sheet?.id];
    const stale = draft && JSON.stringify(draft.base) !== JSON.stringify(sheet);
    const templatePreview = PsdPreviews.get(PsdPreviews.key(projectId, null, template));
    // An empty spread uses the template pixels and the same interactive slot geometry.
    // Retain that base in its draft when the first photo is dropped.
    const preview = draft?.preview ||
        (!sheet?.slots?.length && templatePreview?.status === "ready" ? templatePreview : resolvedPreview.image || resolvedPreview.exact);
    const attemptedPreview = useRef(new Set());
    useEffect(() => {
        if (!sheet || !template || disabled || renderBusy || draft || preview?.status === "ready" || attemptedPreview.current.has(previewKey)) return;
        attemptedPreview.current.add(previewKey);
        if (!sheet.slots?.length && templatePreview?.status !== "ready") onPreviewTemplate?.(template.id);
    }, [previewKey, disabled, renderBusy, sheet?.id]);
    const editedSheet = draft ? {...sheet, slots: draft.slots} : sheet;
    const workingSlots = useRef(editedSheet?.slots || []);
    useEffect(() => { workingSlots.current = editedSheet?.slots || []; }, [sheet?.id, sheet?.slots, draft?.slots]);
    // Restored registries may omit smartObjects until validation. Captured PSD
    // regions carry the real layer IDs and remain valid drop targets.
    const slotTemplate = template?.smartObjects?.length ? template : {
        ...template, smartObjects: (preview?.regions || []).map(region => ({layerId: region.id}))
    };
    const slots = designSlotOverview(editedSheet, slotTemplate);
    const stage = nextSlots => {
        if (disabled || stale || !onDraftChange || !sheet) return false;
        const base = draft?.base || sheet;
        workingSlots.current = nextSlots;
        onDraftChange(sheet.id, JSON.stringify(base.slots) === JSON.stringify(nextSlots) ? null : {
            base, preview: preview?.status === "ready" ? preview : null, slots: nextSlots
        });
        return true;
    };
    const stageCrop = (sheetId, id, cropFocus, position) => stage(editPreviewSlots(workingSlots.current, id, {cropFocus, position}));
    const stageSwap = (sheetId, a, b) => {
        if (!slots.some(slot => String(slot.layerId) === String(b))) return false;
        return stage(editPreviewSlots(workingSlots.current, a, null, b));
    };
    dragState.current.live = setDragLive;
    dragState.current.swap = stageSwap;
    dragState.current.pan = (id, x, y) => movePhoto(id, x, y);
    const apply = () => draft ? onApplyDraft(sheet.id, draft) : onRenderSheet(sheet.id);
    const selectedSlot = slots.find(slot => String(slot.layerId) === String(selectedSlotId));
    const photoById = new Map(allPhotos.map(photo => [String(photo.id), photo]));
    const selectedPhoto = photos.find(photo => String(photo.id) === String(selectedPhotoId));
    const assignedPhoto = photoById.get(String(selectedSlot?.assignment?.photoId));
    const replacePhoto = (photoId = selectedPhotoId, slotId = selectedSlotId) => {
        const target = slots.find(slot => String(slot.layerId) === String(slotId));
        const replacement = photos.find(photo => String(photo.id) === String(photoId));
        if (!target || !replacement) return false;
        const assignment = {slotId: target.layerId, photoId: replacement.id, cropFocus: "center"};
        return stage([...workingSlots.current.filter(slot => String(slot.slotId) !== String(target.layerId)), assignment]);
    };
    dropHandler.current = disabled || stale ? null : (photoId, slotId) => {
        const target = slotId ?? selectedSlotId ?? slots.find(slot => !slot.assignment)?.layerId;
        if (target == null) { setShowSlots(true); return; }
        if (replacePhoto(photoId, target)) {
            setSelectedSlotId(target); setInspector("photo"); setReplaceSlotId(null);
        }
    };
    const draftAwareSheets = sheets.map(item => item.id === sheet?.id ? editedSheet : item);
    const filtered = filterDesignPhotos(photos, draftAwareSheets, query, unused);
    const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length / 40) - 1));
    const filled = slots.filter(slot => slot.assignment).length;
    const act = (label, callback, blocked = false, extra = {}) =>
        <SidebarButton className="design-control" disabled={disabled || blocked} onClick={callback} {...extra}>{label}</SidebarButton>;
    const selectSlot = slot => {
        if (disabled) return;
        if (swapId != null) {
            if (String(swapId) !== String(slot.layerId)) stageSwap(sheet.id, swapId, slot.layerId);
            setSwapId(null);
        }
        setReplaceSlotId(null);
        setSelectedSlotId(slot.layerId); setInspector("photo"); setRightOpen(true);
    };
    const position = normalizePhotoPosition(selectedSlot?.assignment?.position);
    const movePhoto = (id, x, y) => {
        const slot = slots.find(item => String(item.layerId) === String(id));
        const assignment = workingSlots.current.find(item => String(item.slotId) === String(id));
        if (!slot?.assignment || !assignment || disabled) return;
        setSelectedSlotId(slot.layerId); setInspector("photo");
        const region = preview?.regions?.find(item => String(item.id) === String(id));
        const frame = region && draftPhotoFrame(assignment, photoById.get(String(assignment.photoId)), region, preview.aspect, {x, y});
        if (frame && region.supported !== false) stageCrop(sheet.id, id, assignment.cropFocus || "center", frame.position);
    };
    const wheelPhoto = (id, delta) => {
        const assignment = workingSlots.current.find(item => String(item.slotId) === String(id));
        const region = preview?.regions?.find(item => String(item.id) === String(id));
        if (!assignment || region?.supported === false) return;
        setSelectedSlotId(id); setInspector("photo");
        const previous = normalizePhotoPosition(assignment.position);
        const photo = photoById.get(String(assignment.photoId));
        const candidate = region && photo ? zoomPhotoPosition(assignment, photo, region, preview.aspect, delta)
            : normalizePhotoPosition({...previous, zoom: previous.zoom + delta});
        stageCrop(sheet.id, id, assignment.cropFocus || "center", candidate);
    };
    return <section ref={workspaceRoot} className="design-workspace" aria-label="Album design workspace">
        {removeId && <div className="autoflow-modal-backdrop" role="dialog" aria-modal="true" aria-label="Remove spread?">
            <div className="autoflow-modal-container design-flow-dialog">
                <div className="autoflow-modal-header"><h3>Remove spread?</h3></div>
                <div className="autoflow-modal-body"><p>Remove {sheets.find(item => item.id === removeId)?.label || removeId} and its pending edits? Original photos stay in the library.</p></div>
                <div className="autoflow-modal-footer">
                    {act("Cancel", () => setRemoveId(null))}
                    {act("Remove", () => {onRemoveSheet(removeId); setRemoveId(null);})}
                </div>
            </div>
        </div>}
        <header className="design-toolbar">
            {act(leftOpen ? "Hide assets" : "Show assets", () => setLeftOpen(!leftOpen))}
            <strong>Design</strong>{act("↶", onDesignUndo, !canDesignUndo, {"aria-label":"Undo design"})}{act("↷", onDesignRedo, !canDesignRedo, {"aria-label":"Redo design"})}<span className="design-muted">{sheets.length} spreads · {photos.length} final photos</span>
            <div className="design-toolbar-actions">
                {Object.keys(drafts).length > 0 && act(`Apply all (${Object.keys(drafts).length})`, onApplyAllDrafts, renderBusy)}
                {act("Arrange photos", onArrange, !templates.length || !photos.length || Object.keys(drafts).length > 0)}
                {act("Export album", onExport, !sheets.length || Object.keys(drafts).length > 0, {className: "design-control design-primary"})}
                {act(rightOpen ? "Hide settings" : "Show settings", () => setRightOpen(!rightOpen))}
            </div>
        </header>
        <div className="design-notice" role="status" title={error || ""}>
            {error || (stale ? "Spread changed. Discard this draft before continuing." :
                disabled ? "Processing…" : draft ? "Draft preview · Changes are not applied yet." : "")}
        </div>
        <div className="design-columns">
            <aside className="design-assets" style={{display: leftOpen ? "flex" : "none"}} aria-label="Photos and templates">
                <div className="design-tabs">
                    {act("Photos", () => setTab("photos"), false, {"aria-pressed": tab === "photos"})}
                    {act("Templates", () => setTab("templates"), false, {"aria-pressed": tab === "templates"})}
                </div>
                <div className="design-asset-body" style={{display: tab === "photos" ? "flex" : "none"}}>
                    <input aria-label="Search final photos" placeholder="Search photos…" value={query} onChange={event => setQuery(event.target.value)} disabled={disabled}/>
                    <div className="design-tabs">
                        {act("All", () => setUnused(false), false, {"aria-pressed": !unused})}
                        {act("Unused", () => setUnused(true), false, {"aria-pressed": unused})}
                        <span className="design-muted">{filtered.length}</span>
                    </div>
                    <div className="design-photo-list">
                        {filtered.slice(pageIndex * 40, pageIndex * 40 + 40).map(photo => <SidebarButton key={photo.id}
                            data-asset-photo={photo.id} className={"design-photo" + (String(photo.id) === String(selectedPhotoId) ? " is-selected" : "")}
                            disabled={disabled} aria-label={"Select " + (photo.name || photo.id)}
                            aria-pressed={String(photo.id) === String(selectedPhotoId)} onClick={() => {
                                onSelectPhoto(photo.id);
                                if (replaceSlotId != null && replacePhoto(photo.id, replaceSlotId)) setReplaceSlotId(null);
                            }}>
                            <div className="design-photo-image"><ImageComponent photo={photo} alt={photo.name || "Photo"} role="design-assets"/></div>
                            <span>{photo.name || photo.id}</span>
                        </SidebarButton>)}
                        {!filtered.length && <p className="design-muted">{unused ? "All final photos are placed." : "No matching photos."}</p>}
                    </div>
                    {filtered.length > 40 && <div className="design-tabs">
                        {act("Previous", () => setPage(pageIndex - 1), pageIndex === 0)}
                        <span>{pageIndex + 1}/{Math.ceil(filtered.length / 40)}</span>
                        {act("Next", () => setPage(pageIndex + 1), (pageIndex + 1) * 40 >= filtered.length)}
                    </div>}
                    <p className="design-help">{replaceSlotId != null
                        ? "Choose a photo to place in the selected slot."
                        : "Select a slot, choose Change photo, then select a photo here."}</p>
                </div>
                <div className="design-template-body" style={{display: tab === "templates" ? "block" : "none"}}>
                    <p className="design-help">Template for the next spread</p>
                    {templates.map(item => {
                        const image = PsdPreviews.get(PsdPreviews.key(projectId, null, item));
                        return <div key={item.id}>
                            <SidebarButton className="design-template-item" disabled={disabled}
                                aria-pressed={item.id === (templateId || templates[0]?.id)} onClick={() => onSelectTemplate(item.id)}>
                                {image?.status === "ready" && <img src={image.src} alt="Template PSD preview"/>}
                                <strong>{item.name || item.fileName}</strong><span className="design-muted">{item.smartObjects?.length || item.slotCount || 0} photo slots</span>
                            </SidebarButton>
                            {act(templatePreviewLoadingId === item.id ? "Loading preview…" : "Update template preview", () => onPreviewTemplate?.(item.id), renderBusy)}
                            {templatePreviewLoadingId === item.id && <span role="status">Loading template preview…</span>}
                            {act("+ Add spread", () => onAddSheet(item.id), renderBusy)}
                            {image?.status === "error" && <span>Preview unavailable. Try again.</span>}
                        </div>;
                    })}
                    {act("+ Add spread", onAddSheet, !templates.length)}
                    {!draft && templateTools}
                </div>
            </aside>
            <main className="design-center" aria-label="Spread workspace">
                <div className="design-canvas-heading">
                    <div><strong>{sheet?.label || sheet?.id || "Create your first spread"}</strong>
                        {sheet && <span className="design-muted">{filled}/{slots.length} photos · {template?.name || sheet.templateId}</span>}</div>
                    {renderBusy && onCancelPreview && <SidebarButton onClick={onCancelPreview}>Cancel</SidebarButton>}
                    {sheet && <div className="design-tabs">
                        {act(showSlots ? "Show preview" : "Edit photos", () => setShowSlots(!showSlots))}
                        {act(renderBusy ? "Rendering…" : draft ? "Apply changes" : "Update preview", () => draft || filled ? apply() : onPreviewTemplate?.(template.id), renderBusy || !template || stale)}
                        {draft ? act("Discard changes", () => onDraftChange(sheet.id, null)) : act("Open in Photoshop", apply, renderBusy || !filled)}
                    </div>}
                </div>
                <div className={"design-canvas-scroll" + (showSlots ? "" : " design-canvas-fit")}>
                    {!sheet ? <div className="design-start"><h3>Your album starts here</h3><p>Choose a template or arrange your final photos into spreads.</p>
                        {act(templates.length ? "Arrange photos" : "Choose templates", () => templates.length ? onArrange() : (setTab("templates"), setLeftOpen(true)), templates.length > 0 && !photos.length)}</div> :
                        <div className={showSlots ? "" : "design-preview-viewport"}>
                        {!showSlots && <div className="design-exact-preview">
                            {preview?.status === "ready" ? <InteractiveSpreadPreview live={dragLive} preview={preview} previewKey={previewKey} sheet={editedSheet} base={draft?.base || sheet} photos={allPhotos} selectedSlotId={selectedSlotId}
                                disabled={disabled || stale || !onDraftChange} onSwap={stageSwap} onPan={movePhoto} onZoom={wheelPhoto}
                                onSelect={id => { const slot = slots.find(item => String(item.layerId) === String(id)); if (slot) selectSlot(slot); }}/> :
                                <p role="status">{renderBusy || preview?.status === "rendering" ? "Rendering preview…" :
                                    preview?.status === "error" ? "Preview unavailable. Update to retry." :
                                        "Update preview to see the layout."}</p>}
                        </div>}
                        <div className="design-slot-overview" style={{display: showSlots ? "flex" : "none"}}>
                            {slots.map((slot, index) => {
                                const photo = photoById.get(String(slot.assignment?.photoId));
                                return <SidebarButton key={slot.layerId} className={"design-canvas-slot" + (String(selectedSlotId) === String(slot.layerId) ? " is-selected" : "")}
                                    data-drop-slot={slot.layerId} aria-label={"Select photo slot " + (index + 1)} aria-pressed={String(selectedSlotId) === String(slot.layerId)}
                                    disabled={disabled} onClick={() => selectSlot(slot)}>
                                    {photo ? <ImageComponent photo={photo} alt={photo.name || "Assigned photo"} profile="preview" initialProfile="thumbnail" role="design-canvas"/> : <div className="design-empty-slot">+<span>Empty slot</span></div>}
                                    <span className="design-slot-caption">{index + 1} · {photo?.name || slot.layerName || "Photo slot"}</span>
                                </SidebarButton>;
                            })}
                            {!slots.length && <p>No photo slots available. Open and register the PSD template.</p>}
                        </div></div>}
                </div>
                <div className="design-canvas-note">{swapId != null ? "Select another slot to swap photos." : showSlots ? "Photo assignments · Show preview for layout." : preview?.regions?.length ? "Drag to move · Drop on another photo to swap · Scroll to zoom · Apply when ready." : "Rendered preview · Update after edits."}</div>
                <SheetStoryboardStrip compact projectId={projectId} photos={allPhotos}
                    onRefresh={id => { if (drafts[id]) { onApplyDraft(id, drafts[id]); return; }
                        const target = sheets.find(item => item.id === id); if (target) onSelectSheet(target);
                        if (target?.slots?.length) onRenderSheet(id); else if (target) onPreviewTemplate?.(target.templateId);
                    }} draftSheetIds={Object.keys(drafts)} renderBusy={renderBusy}
                    renderDraft={target => {
                        const item = drafts[target.id];
                        const t = templates.find(value => value.id === target.templateId);
                        const image = item?.preview || PsdPreviews.resolve(projectId,target,t,allPhotos).image;
                        return image?.status === "ready" && (item || image.template) ? <InteractiveSpreadPreview readOnly
                            preview={image} sheet={{...target, slots: item?.slots || target.slots}} base={item?.base || target}
                            photos={allPhotos}/> : null;
                    }}
                    refreshDisabled={disabled || stale}
                    sheets={sheets} selectedSheetId={sheet?.id} templates={templates}
                    onSelectSheet={value => {if (!disabled) onSelectSheet(value);}} onMoveSheet={onMoveSheet}
                    onDuplicateSheet={onDuplicateSheet} onRemoveSheet={setRemoveId}
                    onAddSheet={templates.length ? onAddSheet : null} disabled={disabled}/>
            </main>
            <aside className="design-inspector" style={{display: rightOpen ? "flex" : "none"}} aria-label="Selected item settings">
                <div className="design-tabs">
                    {act("Spread", () => setInspector("spread"), false, {"aria-pressed": inspector === "spread"})}
                    {act("Photo", () => setInspector("photo"), !selectedSlot, {"aria-pressed": inspector === "photo"})}
                    {act("Text", () => setInspector("text"), false, {"aria-pressed": inspector === "text"})}
                </div>
                <div className="design-settings-scroll">
                    {inspector === "spread" && (sheet ? <div className="design-setting-group">
                        <label>Spread name<input aria-label="Spread name" value={name} disabled={disabled} onChange={event => setName(event.target.value)}/></label>
                        {act("Save name", () => onRenameSheet(sheet.id, name.trim()), !!draft || !name.trim() || name.trim() === (sheet.label || sheet.id))}
                        <label>Template<span>{template?.name || sheet.templateId}</span></label>
                        <label>Photos<span>{filled} of {slots.length} slots filled</span></label>
                        <div className="design-tabs">
                            {act("←", () => onMoveSheet(sheet.id, sheets.findIndex(item => item.id === sheet.id) - 1), sheets[0]?.id === sheet.id, {"aria-label": "Move spread earlier"})}
                            {act("→", () => onMoveSheet(sheet.id, sheets.findIndex(item => item.id === sheet.id) + 1), sheets[sheets.length - 1]?.id === sheet.id, {"aria-label": "Move spread later"})}
                            {act("Duplicate", () => onDuplicateSheet(sheet.id), !!draft)}
                        </div>
                        {act("Remove spread", () => setRemoveId(sheet.id))}
                    </div> : <p className="design-help">Select or add a spread.</p>)}
                    {inspector === "photo" && <div className="design-setting-group">
                        <strong>{selectedSlot?.layerName || "Photo slot"}</strong>
                        <p className="design-muted">{assignedPhoto?.name || "Empty slot"}</p>
                        {replaceSlotId != null && String(replaceSlotId) === String(selectedSlot?.layerId)
                            ? act("Cancel photo change", () => setReplaceSlotId(null))
                            : act(assignedPhoto ? "Change photo" : "Place photo", () => {
                                if (!selectedSlot) return;
                                setReplaceSlotId(selectedSlot.layerId); setLeftOpen(true); setTab("photos");
                            }, !selectedSlot)}
                        <p className="design-help">{replaceSlotId != null && String(replaceSlotId) === String(selectedSlot?.layerId)
                            ? "Choose a photo from the left. This slot stays selected until the photo is changed."
                            : "Select Change photo, then choose a photo from the left."}</p>
                        <label>Position</label>
                        <div className="design-tabs">
                            {[["←", -.02, 0], ["↑", 0, -.02], ["↓", 0, .02], ["→", .02, 0]].map(([label, x, y]) =>
                                act(label, () => movePhoto(selectedSlot.layerId, x, y), !selectedSlot?.assignment, {key: label, "aria-label": "Move photo " + label}))}
                        </div>
                        <label>Zoom</label>
                        <div className="design-tabs">
                            {act("−", () => wheelPhoto(selectedSlot.layerId, -.1), !selectedSlot?.assignment || position.zoom <= 1, {"aria-label": "Zoom out photo"})}
                            <span>{Math.round(position.zoom * 100)}%</span>
                            {act("+", () => wheelPhoto(selectedSlot.layerId, .1), !selectedSlot?.assignment || position.zoom >= 3, {"aria-label": "Zoom in photo"})}
                        </div>
                        {act("Reset position & zoom", () => stageCrop(sheet.id, selectedSlot.layerId, "center"), !selectedSlot?.assignment)}
                        <label>Crop focus</label>
                        <UxpDropdown ariaLabel="Photo crop focus" value={selectedSlot?.assignment?.cropFocus || "center"}
                            disabled={disabled || !selectedSlot?.assignment} options={CROP_FOCUS_OPTIONS.map(value => ({value, label: value[0].toUpperCase() + value.slice(1)}))}
                            onValueChange={value => stageCrop(sheet.id, selectedSlot.layerId, value)}/>
                        {act(swapId != null ? "Cancel swap" : "Swap with another slot", () => { setSwapId(swapId != null ? null : selectedSlot.layerId); }, !selectedSlot?.assignment || slots.length < 2)}
                        {act("Remove photo", () => stage(workingSlots.current.filter(item =>
                            String(item.slotId) !== String(selectedSlot.layerId))), !selectedSlot?.assignment)}
                    </div>}
                    <div style={{display: inspector === "text" ? "block" : "none"}}>
                        <p className="design-help">Templates → Open PSD loads text controls.</p>
                        <div ref={typographyTargetRef}/>
                    </div>
                </div>
            </aside>
        </div>
    </section>;
}
