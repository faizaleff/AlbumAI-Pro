import React, { useState, useMemo } from "react";
import {
    PrintPresetType,
    StandardAlbumSizes,
    BleedPreset,
    calculatePrintDimensions,
    preflightAlbumForPrint,
    generatePdfProofManifest
} from "../services/PrintExportPresetEngine";

export default function PrintProofModal({
    isOpen = false,
    onClose,
    album = null,
    photos = [],
    templates = [],
    onExportPrint,
    disabled = false
}) {
    const [presetType, setPresetType] = useState(PrintPresetType.LAB_300_DPI_FLUSHMOUNT);
    const [selectedSizeKey, setSelectedSizeKey] = useState("SIZE_12X12");
    const [bleedInches, setBleedInches] = useState(BleedPreset.STANDARD_0125);
    const [watermarkText, setWatermarkText] = useState("PROOF - DO NOT PRINT");
    const [includePageNumbers, setIncludePageNumbers] = useState(true);
    const [clientName, setClientName] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState(null);

    const currentSizePreset = StandardAlbumSizes[selectedSizeKey] || StandardAlbumSizes.SIZE_12X12;

    const printDimensions = useMemo(() =>
        calculatePrintDimensions(currentSizePreset, bleedInches, 300),
        [currentSizePreset, bleedInches]
    );

    const preflight = useMemo(() => {
        if (!isOpen || !album) return null;
        return preflightAlbumForPrint({
            album,
            photos,
            templates,
            sizePreset: currentSizePreset,
            targetDpi: 300
        });
    }, [isOpen, album, photos, templates, currentSizePreset]);

    if (!isOpen) return null;

    const handleExport = async (actionType = "PRINT") => {
        setIsExporting(true);
        setExportMessage(null);
        try {
            if (actionType === "PDF_PROOF") {
                const manifest = generatePdfProofManifest({
                    album,
                    photos,
                    templates,
                    proofConfig: {
                        watermarkText,
                        includePageNumbers,
                        clientName
                    }
                });
                if (onExportPrint) {
                    await onExportPrint({ type: "PDF_PROOF", manifest, printDimensions });
                }
                setExportMessage(`✓ PDF Proof Manifest generated for ${manifest.totalPages} spreads.`);
            } else {
                if (preflight && !preflight.isReadyForPrint) {
                    const spreadDetails = (preflight.unfilledSlotDetails || [])
                        .map(d => `${d.sheetLabel}: ${d.assignedCount ?? 0}/${d.totalCount ?? (d.assignedCount + d.missingCount)} assigned`)
                        .join(", ");
                    const errorMsg = `Lab Print Batch blocked: ${preflight.unfilledSlots} empty slot(s) across ${preflight.unfilledSlotDetails.length} incomplete spread(s). (${spreadDetails})`;
                    setExportMessage(`Error: ${errorMsg}`);
                    return;
                }
                if (onExportPrint) {
                    await onExportPrint({
                        type: "LAB_PRINT",
                        presetType,
                        sizePreset: currentSizePreset,
                        bleedInches,
                        printDimensions
                    });
                }
                setExportMessage(`✓ Lab Print Batch initiated (${printDimensions.totalWidthPx}×${printDimensions.totalHeightPx}px @ 300 DPI).`);
            }
        } catch (err) {
            setExportMessage(`Error: ${err?.message || "Failed to execute print action."}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="print-proof-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="print-proof-modal-container" onClick={e => e.stopPropagation()}>
                <div className="print-proof-modal-header">
                    <div className="print-proof-title-group">
                        <span className="print-proof-icon">🖨</span>
                        <h3>Print Export & PDF Proofing Engine</h3>
                    </div>
                    <button
                        type="button"
                        className="print-proof-close-btn"
                        onClick={onClose}
                        disabled={isExporting}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div className="print-proof-modal-body">
                    {/* Preset Selection */}
                    <div className="print-proof-section">
                        <label className="print-proof-section-label">Export Preset</label>
                        <div className="print-proof-preset-grid">
                            <button
                                type="button"
                                className={`print-proof-preset-card${presetType === PrintPresetType.LAB_300_DPI_FLUSHMOUNT ? " is-active" : ""}`}
                                onClick={() => setPresetType(PrintPresetType.LAB_300_DPI_FLUSHMOUNT)}
                                disabled={isExporting}
                            >
                                <span className="preset-name">🏆 300 DPI Lab Print Profile</span>
                                <span className="preset-desc">Full 300 DPI resolution, 0.125" bleed margins for professional lab printing</span>
                            </button>

                            <button
                                type="button"
                                className={`print-proof-preset-card${presetType === PrintPresetType.MULTI_PAGE_PDF_PROOF ? " is-active" : ""}`}
                                onClick={() => setPresetType(PrintPresetType.MULTI_PAGE_PDF_PROOF)}
                                disabled={isExporting}
                            >
                                <span className="preset-name">📄 Multi-Page Client PDF Proof</span>
                                <span className="preset-desc">Aggregated proof sheet with studio watermark and spread sequencing</span>
                            </button>

                            <button
                                type="button"
                                className={`print-proof-preset-card${presetType === PrintPresetType.SOCIAL_WEB_PREVIEW ? " is-active" : ""}`}
                                onClick={() => setPresetType(PrintPresetType.SOCIAL_WEB_PREVIEW)}
                                disabled={isExporting}
                            >
                                <span className="preset-name">🌐 Social & Web Spreads</span>
                                <span className="preset-desc">72 DPI sRGB 2048px optimized JPEG spreads for client sharing</span>
                            </button>
                        </div>
                    </div>

                    {/* Dimensions & Bleed */}
                    <div className="print-proof-section">
                        <label className="print-proof-section-label">Print Dimensions & Bleed</label>
                        <div className="print-proof-form-row">
                            <div className="print-proof-field">
                                <span className="field-label">Album Size</span>
                                <select
                                    className="print-proof-select"
                                    value={selectedSizeKey}
                                    onChange={e => setSelectedSizeKey(e.target.value)}
                                    disabled={isExporting}
                                >
                                    {Object.entries(StandardAlbumSizes).map(([key, size]) => (
                                        <option key={key} value={key}>{size.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="print-proof-field">
                                <span className="field-label">Bleed Margin</span>
                                <select
                                    className="print-proof-select"
                                    value={bleedInches}
                                    onChange={e => setBleedInches(Number(e.target.value))}
                                    disabled={isExporting}
                                >
                                    <option value={BleedPreset.NONE}>None (Exact Trim: 0")</option>
                                    <option value={BleedPreset.STANDARD_0125}>Standard (0.125" / 3.2mm)</option>
                                    <option value={BleedPreset.EXTENDED_025}>Extended (0.25" / 6.4mm)</option>
                                </select>
                            </div>
                        </div>

                        <div className="print-proof-dims-box">
                            <div className="dims-detail">
                                <span className="dims-label">Canvas Pixel Dimensions:</span>
                                <strong className="dims-val highlight">
                                    {printDimensions.totalWidthPx} × {printDimensions.totalHeightPx} px
                                </strong>
                            </div>
                            <div className="dims-detail">
                                <span className="dims-label">Trim Dimensions:</span>
                                <span className="dims-val">
                                    {printDimensions.widthIn}" × {printDimensions.heightIn}" ({printDimensions.baseWidthPx}×{printDimensions.baseHeightPx} px @ 300 DPI)
                                </span>
                            </div>
                            {bleedInches > 0 && (
                                <div className="dims-detail">
                                    <span className="dims-label">Bleed Added:</span>
                                    <span className="dims-val">+{printDimensions.bleedPxPerSide * 2} px (+{bleedInches * 2}")</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Watermark & Client Proofing */}
                    <div className="print-proof-section">
                        <label className="print-proof-section-label">Proof Watermark & Metadata</label>
                        <div className="print-proof-form-row">
                            <div className="print-proof-field flex-2">
                                <span className="field-label">Watermark Text</span>
                                <input
                                    type="text"
                                    className="print-proof-input"
                                    value={watermarkText}
                                    onChange={e => setWatermarkText(e.target.value)}
                                    placeholder="e.g. PROOF - DO NOT PRINT"
                                    disabled={isExporting}
                                />
                            </div>

                            <div className="print-proof-field flex-1">
                                <span className="field-label">Client Name</span>
                                <input
                                    type="text"
                                    className="print-proof-input"
                                    value={clientName}
                                    onChange={e => setClientName(e.target.value)}
                                    placeholder="Optional client name"
                                    disabled={isExporting}
                                />
                            </div>
                        </div>

                        <label className="print-proof-checkbox-row">
                            <input
                                type="checkbox"
                                checked={includePageNumbers}
                                onChange={e => setIncludePageNumbers(e.target.checked)}
                                disabled={isExporting}
                            />
                            <span>Include spread page numbers (e.g. "Spread 1 of {album?.sheets?.length || 0}")</span>
                        </label>
                    </div>

                    {/* Preflight Quality Checklist */}
                    <div className="print-proof-preflight-box">
                        <div className="preflight-header">
                            <strong>Preflight Quality Checklist</strong>
                            <span className={`preflight-badge${preflight?.isReadyForPrint ? " is-ready" : " has-warning"}`}>
                                {preflight?.isReadyForPrint ? "✓ Ready for Print" : "⚠ Preflight Warning"}
                            </span>
                        </div>

                        <div className="preflight-stats">
                            <div className="preflight-stat-item">
                                <span>Spreads:</span>
                                <strong>{preflight?.totalSheets || 0}</strong>
                            </div>
                            <div className="preflight-stat-item">
                                <span>Slots:</span>
                                <strong>{preflight?.filledSlots || 0} / {preflight?.totalSlots || 0} filled</strong>
                            </div>
                            <div className="preflight-stat-item">
                                <span>Resolution:</span>
                                <strong className={preflight?.lowResolutionWarnings?.length > 0 ? "warning" : "ok"}>
                                    {preflight?.lowResolutionWarnings?.length > 0
                                        ? `${preflight.lowResolutionWarnings.length} low-res warnings`
                                        : "✓ All photos >= 200 DPI"}
                                </strong>
                            </div>
                        </div>

                        {preflight?.unfilledSlots > 0 && (
                            <div className="preflight-alert">
                                ⛔ {preflight.unfilledSlots} empty slot(s) across {preflight.unfilledSlotDetails.length} spread(s). Lab Print Batch is blocked until all slots are assigned:
                                <div style={{ marginTop: "4px", fontSize: "0.85em" }}>
                                    {preflight.unfilledSlotDetails.map(d => (
                                        <div key={d.sheetId || d.sheetIndex}>
                                            • {d.sheetLabel}: {d.assignedCount ?? 0}/{d.totalCount ?? 0} assigned ({d.missingCount} empty)
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {preflight?.lowResolutionWarnings?.length > 0 && (
                            <div className="preflight-alert warning">
                                ⚠ {preflight.lowResolutionWarnings[0].photoName} has effective resolution of {preflight.lowResolutionWarnings[0].effectiveDpi} DPI.
                            </div>
                        )}
                    </div>

                    {exportMessage && (
                        <div className={`print-proof-message${exportMessage.startsWith("Error") ? " error" : " success"}`}>
                            {exportMessage}
                        </div>
                    )}
                </div>

                <div className="print-proof-modal-footer">
                    <button
                        type="button"
                        className="print-proof-cancel-btn"
                        onClick={onClose}
                        disabled={isExporting}
                    >
                        Close
                    </button>

                    <button
                        type="button"
                        className="print-proof-action-btn secondary"
                        onClick={() => handleExport("PDF_PROOF")}
                        disabled={isExporting || disabled || !album?.sheets?.length}
                        title="Generate Multi-Page PDF Proof Manifest"
                    >
                        📄 Generate PDF Proof Sheet
                    </button>

                    <button
                        type="button"
                        className="print-proof-action-btn primary"
                        onClick={() => handleExport("PRINT")}
                        disabled={isExporting || disabled || !album?.sheets?.length || (preflight && !preflight.isReadyForPrint)}
                        title={preflight && !preflight.isReadyForPrint ? "Fill all empty slots before exporting Lab Print Batch" : "Export 300 DPI Print Spreads Batch"}
                    >
                        {isExporting ? "Exporting…" : "⚡ Export Lab Print Batch"}
                    </button>
                </div>
            </div>
        </div>
    );
}
