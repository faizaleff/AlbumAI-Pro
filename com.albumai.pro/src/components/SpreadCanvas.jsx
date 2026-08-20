import React, { useState } from "react";
import PhotoImage from "./PhotoImage";

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
