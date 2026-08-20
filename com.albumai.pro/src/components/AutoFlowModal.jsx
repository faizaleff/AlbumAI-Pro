import React, { useState, useMemo } from "react";
import {
    AutoFlowStrategy,
    PhotoSourceMode,
    filterPhotosForAutoFlow,
    generateAutoFlowSpreads,
    getTemplateSlotCapacity
} from "../services/PhotoAutoFlowEngine";
import { CullingStatus } from "../services/PhotoCullingService";

export default function AutoFlowModal({
    isOpen = false,
    onClose,
    photos = [],
    selectedPhotoIds = new Set(),
    templates = [],
    existingSheetCount = 0,
    onApplyAutoFlow,
    disabled = false
}) {
    const [sourceMode, setSourceMode] = useState(PhotoSourceMode.KEPT_ONLY);
    const [strategy, setStrategy] = useState(AutoFlowStrategy.CHRONOLOGICAL_BURST);
    const [maxPhotosPerSpread, setMaxPhotosPerSpread] = useState(3);
    const [isBusy, setIsBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const keptCount = useMemo(() =>
        photos.filter(p => p.culling?.status === CullingStatus.KEEP || p.culling?.status === "KEPT").length,
        [photos]
    );
    const selectedCount = selectedPhotoIds instanceof Set ? selectedPhotoIds.size : (selectedPhotoIds?.length || 0);
    const nonRejectedCount = useMemo(() =>
        photos.filter(p => p.culling?.status !== CullingStatus.REJECT && p.culling?.status !== "REJECTED").length,
        [photos]
    );

    const filteredPhotos = useMemo(() =>
        filterPhotosForAutoFlow(photos, sourceMode, selectedPhotoIds),
        [photos, sourceMode, selectedPhotoIds]
    );

    const maxAvailableSlots = useMemo(() => {
        const capacities = (templates || []).map(getTemplateSlotCapacity);
        return capacities.length > 0 ? Math.max(...capacities, 0) : 0;
    }, [templates]);

    const estimatedResult = useMemo(() => {
        if (!isOpen || filteredPhotos.length === 0 || templates.length === 0) {
            return null;
        }
        return generateAutoFlowSpreads({
            photos: filteredPhotos,
            templates,
            options: {
                strategy,
                maxPhotosPerSpread,
                startIndex: 1
            }
        });
    }, [isOpen, filteredPhotos, templates, strategy, maxPhotosPerSpread]);

    if (!isOpen) return null;

    const handleGenerate = async (append = false) => {
        if (filteredPhotos.length === 0) {
            setErrorMessage("No photos available for the selected source mode.");
            return;
        }
        if (templates.length === 0) {
            setErrorMessage("Please register at least one PSD template in Project Templates first.");
            return;
        }

        setIsBusy(true);
        setErrorMessage(null);

        try {
            const startIndex = append ? existingSheetCount + 1 : 1;
            const result = generateAutoFlowSpreads({
                photos: filteredPhotos,
                templates,
                options: {
                    strategy,
                    maxPhotosPerSpread,
                    startIndex
                }
            });

            if (!result.success || result.sheets.length === 0) {
                setErrorMessage("Auto-Flow could not generate spreads with the current settings.");
                setIsBusy(false);
                return;
            }

            await onApplyAutoFlow(result.sheets, append);
            onClose();
        } catch (err) {
            setErrorMessage(err?.message || "Failed to generate auto-flow spreads.");
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="autoflow-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="autoflow-modal-container" onClick={e => e.stopPropagation()}>
                <div className="autoflow-modal-header">
                    <div className="autoflow-modal-title">
                        <span className="autoflow-icon">⚡</span>
                        <h3>Smart Auto-Flow Engine</h3>
                    </div>
                    <button
                        type="button"
                        className="autoflow-close-btn"
                        onClick={onClose}
                        disabled={isBusy}
                        aria-label="Close Auto-Flow"
                    >
                        ✕
                    </button>
                </div>

                <div className="autoflow-modal-body">
                    {/* Source mode selector */}
                    <div className="autoflow-section">
                        <label className="autoflow-section-label">Source Photos</label>
                        <div className="autoflow-pill-group" role="radiogroup" aria-label="Photo source mode">
                            <button
                                type="button"
                                className={`autoflow-pill-btn${sourceMode === PhotoSourceMode.KEPT_ONLY ? " is-active" : ""}`}
                                onClick={() => setSourceMode(PhotoSourceMode.KEPT_ONLY)}
                                disabled={isBusy}
                            >
                                <span className="pill-icon">⭐</span>
                                <span>Kept Photos ({keptCount})</span>
                            </button>
                            <button
                                type="button"
                                className={`autoflow-pill-btn${sourceMode === PhotoSourceMode.SELECTED_ONLY ? " is-active" : ""}`}
                                onClick={() => setSourceMode(PhotoSourceMode.SELECTED_ONLY)}
                                disabled={isBusy || selectedCount === 0}
                            >
                                <span className="pill-icon">☑</span>
                                <span>Selection ({selectedCount})</span>
                            </button>
                            <button
                                type="button"
                                className={`autoflow-pill-btn${sourceMode === PhotoSourceMode.ALL_PHOTOS ? " is-active" : ""}`}
                                onClick={() => setSourceMode(PhotoSourceMode.ALL_PHOTOS)}
                                disabled={isBusy}
                            >
                                <span className="pill-icon">📁</span>
                                <span>All Non-Rejected ({nonRejectedCount})</span>
                            </button>
                        </div>
                    </div>

                    {/* Flow Strategy */}
                    <div className="autoflow-section">
                        <label className="autoflow-section-label">Layout Strategy</label>
                        <div className="autoflow-strategy-grid">
                            <button
                                type="button"
                                className={`autoflow-strategy-btn${strategy === AutoFlowStrategy.CHRONOLOGICAL_BURST ? " is-active" : ""}`}
                                onClick={() => setStrategy(AutoFlowStrategy.CHRONOLOGICAL_BURST)}
                                disabled={isBusy}
                            >
                                <strong className="strategy-title">Chronological Burst</strong>
                                <span className="strategy-desc">Groups photo bursts into cohesive spreads by timeline</span>
                            </button>
                            <button
                                type="button"
                                className={`autoflow-strategy-btn${strategy === AutoFlowStrategy.HERO_DYNAMIC ? " is-active" : ""}`}
                                onClick={() => setStrategy(AutoFlowStrategy.HERO_DYNAMIC)}
                                disabled={isBusy}
                            >
                                <strong className="strategy-title">Hero Dynamic</strong>
                                <span className="strategy-desc">Awards highest-rated 5-star photos full hero single spreads</span>
                            </button>
                            <button
                                type="button"
                                className={`autoflow-strategy-btn${strategy === AutoFlowStrategy.BALANCED ? " is-active" : ""}`}
                                onClick={() => setStrategy(AutoFlowStrategy.BALANCED)}
                                disabled={isBusy}
                            >
                                <strong className="strategy-title">Balanced Density</strong>
                                <span className="strategy-desc">Distributes photos evenly across template layouts</span>
                            </button>
                        </div>
                    </div>

                    {/* Photos per spread */}
                    <div className="autoflow-section">
                        <div className="autoflow-row">
                            <label className="autoflow-section-label" htmlFor="max-photos-select">
                                Max Photos Per Spread
                            </label>
                            <select
                                id="max-photos-select"
                                className="autoflow-select"
                                value={maxPhotosPerSpread}
                                onChange={e => setMaxPhotosPerSpread(Number(e.target.value))}
                                disabled={isBusy}
                            >
                                <option value={1}>1 Photo (Full Page Hero Spreads)</option>
                                <option value={2}>2 Photos (Dual Page Layouts)</option>
                                <option value={3}>3 Photos (Standard Balanced Spread)</option>
                                <option value={4}>4 Photos (Multi-photo Grid Spreads)</option>
                                <option value={6}>6 Photos (Dense Collage Spreads)</option>
                            </select>
                        </div>
                    </div>

                    {/* Estimation summary */}
                    <div className="autoflow-summary-box">
                        <div className="summary-stat-row">
                            <span className="summary-label">Available Photos:</span>
                            <strong className="summary-value">{filteredPhotos.length}</strong>
                        </div>
                        <div className="summary-stat-row">
                            <span className="summary-label">Registered Templates:</span>
                            <strong className="summary-value">{templates.length}</strong>
                        </div>
                        {maxAvailableSlots > 0 && maxPhotosPerSpread > maxAvailableSlots && (
                            <div className="summary-stat-row">
                                <span className="summary-label">Effective Capacity:</span>
                                <strong className="summary-value highlight" style={{ color: "#e3b341" }}>
                                    {maxAvailableSlots} photos/spread
                                </strong>
                            </div>
                        )}
                        <div className="summary-stat-row">
                            <span className="summary-label">Estimated Spreads:</span>
                            <strong className="summary-value highlight">
                                {estimatedResult?.summary?.totalSheets || 0} spreads
                            </strong>
                        </div>
                        {templates.length === 0 && (
                            <div className="autoflow-warning">
                                ⚠ No PSD templates registered. Please register templates in the Project Templates section.
                            </div>
                        )}
                    </div>

                    {errorMessage && (
                        <div className="autoflow-error">
                            {errorMessage}
                        </div>
                    )}
                </div>

                <div className="autoflow-modal-footer">
                    <button
                        type="button"
                        className="autoflow-cancel-btn"
                        onClick={onClose}
                        disabled={isBusy}
                    >
                        Cancel
                    </button>

                    {existingSheetCount > 0 && (
                        <button
                            type="button"
                            className="autoflow-action-btn secondary"
                            onClick={() => handleGenerate(true)}
                            disabled={isBusy || disabled || filteredPhotos.length === 0 || templates.length === 0}
                            title="Add generated spreads after existing sheets"
                        >
                            + Append Spreads
                        </button>
                    )}

                    <button
                        type="button"
                        className="autoflow-action-btn primary"
                        onClick={() => handleGenerate(false)}
                        disabled={isBusy || disabled || filteredPhotos.length === 0 || templates.length === 0}
                        title="Replace album with new auto-flow spreads"
                    >
                        {isBusy ? "Generating…" : "⚡ Replace Album Spreads"}
                    </button>
                </div>
            </div>
        </div>
    );
}
