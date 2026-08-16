import React, { useEffect, useMemo, useRef, useState } from "react";

import PhotoImage from "./PhotoImage";
import {
    buildManualDesignerView,
    manualDesignerClearMutation,
    manualDesignerCropMutation,
    manualDesignerDropMutation,
    ManualDesignerDragKind,
    ManualDesignerStatus
} from "./manualDesignerModel";
import { photoDecisionKey } from "../services/PhotoBrowserModel";

export default function ManualDesignerPanel({
    sheet,
    templates,
    activeTemplate,
    photos,
    disabled = false,
    busy = false,
    onTemplateChange,
    onLoadTemplate,
    onDesignMutation
}) {
    const [loadBusy, setLoadBusy] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [editBusy, setEditBusy] = useState(false);
    const [editError, setEditError] = useState("");
    const [selectedPhotoKey, setSelectedPhotoKey] = useState(null);
    const [selectedSlotLayerId, setSelectedSlotLayerId] = useState(null);
    const [cropDraft, setCropDraft] = useState(null);
    const loadRequestRef = useRef(0);
    const editRequestRef = useRef(0);
    const loadBusyRef = useRef(false);
    const editBusyRef = useRef(false);
    const dragSourceRef = useRef(null);
    const view = useMemo(() => buildManualDesignerView({
        sheet,
        templates,
        activeTemplate,
        photos
    }), [activeTemplate, photos, sheet, templates]);
    const photoByKey = useMemo(() => {
        const visible = new Set([
            ...view.photos.items.map(item => item.photoKey),
            ...view.slots.map(slot => slot.photoKey).filter(Boolean)
        ]);
        const result = new Map();
        for (const photo of Array.isArray(photos) ? photos : []) {
            const key = photoDecisionKey(photo);
            if (visible.has(key)) result.set(key, photo);
            if (result.size === visible.size) break;
        }
        return result;
    }, [photos, view.photos.items, view.slots]);
    const interactionLocked = disabled || busy || loadBusy || editBusy;
    const selectedSlot = view.slots.find(
        slot => slot.slotLayerId === selectedSlotLayerId
    ) || null;
    const selectedSlotPhoto = selectedSlot?.photoKey
        ? photoByKey.get(selectedSlot.photoKey)
        : null;
    const cropDirty = !!selectedSlot?.cropFocus && !!cropDraft && (
        selectedSlot.cropFocus.x !== cropDraft.x ||
        selectedSlot.cropFocus.y !== cropDraft.y
    );

    useEffect(() => {
        loadRequestRef.current += 1;
        editRequestRef.current += 1;
        dragSourceRef.current = null;
        loadBusyRef.current = false;
        editBusyRef.current = false;
        setLoadBusy(false);
        setLoadError("");
        setEditBusy(false);
        setEditError("");
        setSelectedPhotoKey(null);
        setSelectedSlotLayerId(null);
        setCropDraft(null);
    }, [sheet?.id, sheet?.templateId]);

    useEffect(() => {
        setCropDraft(selectedSlot?.cropFocus
            ? { ...selectedSlot.cropFocus }
            : null);
    }, [
        selectedSlotLayerId,
        selectedSlot?.cropFocus?.x,
        selectedSlot?.cropFocus?.y
    ]);

    async function applyDesignMutation(
        mutation,
        { clearPhoto = false, clearSlot = true } = {}
    ) {
        if (!mutation || interactionLocked || editBusyRef.current) return false;
        const request = ++editRequestRef.current;
        editBusyRef.current = true;
        setEditBusy(true);
        setEditError("");
        try {
            const changed = await onDesignMutation?.(mutation);
            if (request === editRequestRef.current && changed) {
                if (clearPhoto) setSelectedPhotoKey(null);
                if (clearSlot) setSelectedSlotLayerId(null);
            }
            return changed === true;
        } catch (error) {
            if (request === editRequestRef.current) {
                setEditError(error?.message || "The Sheet design could not be saved.");
            }
            return false;
        } finally {
            if (request === editRequestRef.current) {
                editBusyRef.current = false;
                setEditBusy(false);
            }
        }
    }

    function activatePhoto(photoKey) {
        if (interactionLocked) return;
        setSelectedPhotoKey(current => current === photoKey ? null : photoKey);
        setSelectedSlotLayerId(null);
        setEditError("");
    }

    function activateSlot(slot) {
        if (interactionLocked) return;
        if (selectedPhotoKey) {
            applyDesignMutation(manualDesignerDropMutation({
                kind: ManualDesignerDragKind.PHOTO,
                photoKey: selectedPhotoKey
            }, slot.slotLayerId), { clearPhoto: true });
            return;
        }
        if (selectedSlotLayerId && selectedSlotLayerId !== slot.slotLayerId) {
            applyDesignMutation(manualDesignerDropMutation({
                kind: ManualDesignerDragKind.SLOT,
                slotLayerId: selectedSlotLayerId
            }, slot.slotLayerId));
            return;
        }
        setSelectedSlotLayerId(current =>
            current === slot.slotLayerId ? null : slot.slotLayerId
        );
        setEditError("");
    }

    function startDrag(event, source) {
        if (interactionLocked) {
            event.preventDefault?.();
            return;
        }
        dragSourceRef.current = source;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = source.kind === ManualDesignerDragKind.PHOTO
                ? "copy"
                : "move";
            event.dataTransfer.setData?.("text/plain", "albumai-manual-designer");
        }
    }

    function dropOnSlot(event, slotLayerId) {
        event.preventDefault?.();
        const mutation = manualDesignerDropMutation(
            dragSourceRef.current,
            slotLayerId
        );
        dragSourceRef.current = null;
        applyDesignMutation(mutation, {
            clearPhoto: mutation?.intent === "ASSIGN_PHOTO"
        });
    }

    function updateCropDraft(axis, value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        setCropDraft(current => ({
            x: axis === "x" ? number : current?.x ?? 0.5,
            y: axis === "y" ? number : current?.y ?? 0.5
        }));
    }

    function applyCropFocus() {
        if (!selectedSlot || !cropDraft) return;
        applyDesignMutation(manualDesignerCropMutation(
            selectedSlot.slotLayerId,
            cropDraft
        ), { clearSlot: false });
    }

    async function loadSelectedTemplate() {
        if (!view.sheet?.templateId || loadBusy || loadBusyRef.current) return;
        const request = ++loadRequestRef.current;
        loadBusyRef.current = true;
        setLoadBusy(true);
        setLoadError("");
        try {
            await onLoadTemplate?.(view.sheet.templateId);
        } catch (error) {
            if (request === loadRequestRef.current) {
                setLoadError(error?.message || "Template slots could not be loaded.");
            }
        } finally {
            if (request === loadRequestRef.current) {
                loadBusyRef.current = false;
                setLoadBusy(false);
            }
        }
    }

    if (!view.sheet) return null;

    return (
        <section className="manual-designer" aria-label={`Manual designer for ${view.sheet.label}`}>
            <div className="manual-designer-header">
                <div>
                    <strong>Manual Designer</strong>
                    <div className="manual-designer-subtitle">
                        {view.assignedCount}/{view.slots.length} slots assigned
                    </div>
                </div>
                <label className="manual-designer-template-label">
                    Template
                    <select
                        value={view.sheet.templateId}
                        onChange={event => {
                            setLoadError("");
                            onTemplateChange?.(event.target.value);
                        }}
                        disabled={interactionLocked}
                    >
                        {view.templates.map(template => (
                            <option key={template.id} value={template.id}>
                                {template.name}{template.ready ? "" : " — needs validation"}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {view.status === ManualDesignerStatus.TEMPLATE_MISSING && (
                <div className="manual-designer-message is-error">
                    This Sheet template is no longer registered. Choose another template.
                </div>
            )}
            {view.status === ManualDesignerStatus.TEMPLATE_NOT_LOADED && (
                <div className="manual-designer-message">
                    <span>Load the selected PSD to inspect its Smart Object slots.</span>
                    <button
                        type="button"
                        onClick={loadSelectedTemplate}
                        disabled={interactionLocked || !view.selectedTemplate?.ready}
                    >
                        {loadBusy ? "Loading…" : "Load slots"}
                    </button>
                </div>
            )}
            {view.status === ManualDesignerStatus.NO_SLOTS && (
                <div className="manual-designer-message is-error">
                    The selected template has no usable Smart Object slots.
                </div>
            )}
            {loadError && (
                <div className="manual-designer-message is-error">{loadError}</div>
            )}
            {editError && (
                <div className="manual-designer-message is-error">{editError}</div>
            )}

            {view.status === ManualDesignerStatus.READY && (
                <div
                    className="manual-designer-body"
                    onKeyDown={event => {
                        if (event.key === "Escape") {
                            setSelectedPhotoKey(null);
                            setSelectedSlotLayerId(null);
                        }
                    }}
                >
                    <div className="manual-designer-slots" aria-label="Template slots">
                        {view.slots.map((slot, index) => {
                            const photo = slot.photoKey
                                ? photoByKey.get(slot.photoKey)
                                : null;
                            return (
                                <div
                                    key={slot.slotLayerId}
                                    className={`manual-designer-slot${slot.assigned ? " is-assigned" : ""}${selectedSlotLayerId === slot.slotLayerId ? " is-selected" : ""}`}
                                    aria-label={`${slot.name}, ${slot.assigned ? "assigned" : "empty"}`}
                                    draggable={slot.assigned && !interactionLocked}
                                    onDragStart={event => startDrag(event, {
                                        kind: ManualDesignerDragKind.SLOT,
                                        slotLayerId: slot.slotLayerId
                                    })}
                                    onDragEnd={() => {
                                        dragSourceRef.current = null;
                                    }}
                                    onDragOver={event => {
                                        if (!interactionLocked) event.preventDefault?.();
                                    }}
                                    onDrop={event => dropOnSlot(event, slot.slotLayerId)}
                                >
                                    <button
                                        type="button"
                                        className="manual-designer-slot-preview"
                                        onClick={() => activateSlot(slot)}
                                        onKeyDown={event => {
                                            if (["Delete", "Backspace"].includes(event.key) && slot.assigned) {
                                                event.preventDefault();
                                                applyDesignMutation(manualDesignerClearMutation(slot.slotLayerId));
                                            }
                                        }}
                                        aria-pressed={selectedSlotLayerId === slot.slotLayerId}
                                        disabled={interactionLocked}
                                    >
                                        {photo ? (
                                            <PhotoImage
                                                photo={photo}
                                                profile="thumbnail"
                                                role="designer"
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                    objectPosition: `${(slot.cropFocus?.x ?? 0.5) * 100}% ${(slot.cropFocus?.y ?? 0.5) * 100}%`
                                                }}
                                            />
                                        ) : (
                                            <span>{slot.assigned ? "Missing photo" : `Slot ${index + 1}`}</span>
                                        )}
                                    </button>
                                    <div className="manual-designer-slot-footer">
                                        <div className="manual-designer-slot-name">{slot.name}</div>
                                        {slot.assigned && (
                                            <button
                                                type="button"
                                                className="manual-designer-clear-slot"
                                                onClick={() => applyDesignMutation(
                                                    manualDesignerClearMutation(slot.slotLayerId)
                                                )}
                                                disabled={interactionLocked}
                                                aria-label={`Clear ${slot.name}`}
                                                title="Clear slot"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="manual-designer-tray" aria-label="Photo tray">
                        <div className="manual-designer-tray-header">
                            <strong>Photo tray</strong>
                            <span>{view.photos.total} photos</span>
                        </div>
                        <div className="manual-designer-photo-list">
                            {view.photos.items.map(item => {
                                const photo = photoByKey.get(item.photoKey);
                                return (
                                    <div
                                        key={item.photoKey}
                                        className={`manual-designer-photo${item.assignedSlotLayerId ? " is-assigned" : ""}${selectedPhotoKey === item.photoKey ? " is-selected" : ""}`}
                                        title={item.name}
                                        draggable={!interactionLocked}
                                        onDragStart={event => startDrag(event, {
                                            kind: ManualDesignerDragKind.PHOTO,
                                            photoKey: item.photoKey
                                        })}
                                        onDragEnd={() => {
                                            dragSourceRef.current = null;
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="manual-designer-photo-preview"
                                            onClick={() => activatePhoto(item.photoKey)}
                                            aria-pressed={selectedPhotoKey === item.photoKey}
                                            disabled={interactionLocked}
                                        >
                                            {photo && (
                                                <PhotoImage
                                                    photo={photo}
                                                    profile="thumbnail"
                                                    role="designer"
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                />
                                            )}
                                        </button>
                                        <span>{item.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {!!view.photos.hidden && (
                            <div className="manual-designer-tray-limit">
                                Showing {view.photos.items.length} of {view.photos.total} photos.
                            </div>
                        )}
                        {!view.photos.total && (
                            <div className="manual-designer-tray-limit">
                                Open a photo folder to populate the tray.
                            </div>
                        )}
                    </div>
                </div>
            )}
            {view.status === ManualDesignerStatus.READY && selectedSlot?.assigned && cropDraft && (
                <div className="manual-designer-crop" aria-label={`Crop focus for ${selectedSlot.name}`}>
                    <div className="manual-designer-crop-preview">
                        {selectedSlotPhoto ? (
                            <PhotoImage
                                photo={selectedSlotPhoto}
                                profile="preview"
                                role="designer-crop"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    objectPosition: `${cropDraft.x * 100}% ${cropDraft.y * 100}%`
                                }}
                            />
                        ) : (
                            <span>Photo preview unavailable</span>
                        )}
                        <span
                            className="manual-designer-crop-marker"
                            style={{
                                left: `${cropDraft.x * 100}%`,
                                top: `${cropDraft.y * 100}%`
                            }}
                            aria-hidden="true"
                        />
                    </div>
                    <div className="manual-designer-crop-controls">
                        <div className="manual-designer-crop-heading">
                            <strong>Crop focus · {selectedSlot.name}</strong>
                            <span>{Math.round(cropDraft.x * 100)}% × {Math.round(cropDraft.y * 100)}%</span>
                        </div>
                        <label>
                            Horizontal
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={cropDraft.x}
                                onChange={event => updateCropDraft("x", event.target.value)}
                                disabled={interactionLocked}
                                aria-label={`Horizontal crop focus for ${selectedSlot.name}`}
                            />
                        </label>
                        <label>
                            Vertical
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={cropDraft.y}
                                onChange={event => updateCropDraft("y", event.target.value)}
                                disabled={interactionLocked}
                                aria-label={`Vertical crop focus for ${selectedSlot.name}`}
                            />
                        </label>
                        <div className="manual-designer-crop-presets" aria-label="Crop focus presets">
                            {[
                                ["Center", 0.5, 0.5],
                                ["Top", 0.5, 0],
                                ["Bottom", 0.5, 1],
                                ["Left", 0, 0.5],
                                ["Right", 1, 0.5]
                            ].map(([label, x, y]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => setCropDraft({ x, y })}
                                    disabled={interactionLocked}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="manual-designer-crop-actions">
                            <button
                                type="button"
                                onClick={() => setCropDraft({ ...selectedSlot.cropFocus })}
                                disabled={interactionLocked || !cropDirty}
                            >
                                Revert
                            </button>
                            <button
                                type="button"
                                className="manual-designer-apply-crop"
                                onClick={applyCropFocus}
                                disabled={interactionLocked || !cropDirty}
                            >
                                {editBusy ? "Saving…" : "Apply crop focus"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {view.status === ManualDesignerStatus.READY && (
                <div className="manual-designer-help">
                    Select a photo then a slot, or drag it onto a slot. Select two slots to swap or move. Delete clears the focused slot; Escape cancels selection.
                </div>
            )}
        </section>
    );
}
