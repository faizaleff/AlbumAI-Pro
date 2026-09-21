import Button from "./SidebarButton";
import React, { useState, useMemo } from "react";
import { preflightAlbumForPrint } from "../services/PrintExportPresetEngine";

export default function PrintProofModal({ isOpen = false, onClose, album = null, photos = [],
    templates = [], onExportPrint, onCancel, disabled = false }) {
    const [isExporting, setIsExporting] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const preflight = useMemo(() => isOpen ? preflightAlbumForPrint({ album, photos, templates }) : null,
        [isOpen, album, photos, templates]);
    if (!isOpen) return null;
    const close = () => { if (!isExporting) { setError(null); setResult(null); setProgress(null); onClose(); } };
    const run = async () => {
        if (isExporting || disabled || !preflight?.isReadyForPrint) return;
        setIsExporting(true); setStopping(false); setError(null); setResult(null); setProgress(null);
        try {
            if (!onExportPrint) throw new Error("Export is unavailable.");
            const summary = await onExportPrint({ type: "LAB_PRINT", format: "JPEG", requireCompleteSpreads: true }, setProgress);
            if (!summary) throw new Error("Export did not return a result.");
            setResult(summary);
        } catch (failure) {
            setError(failure?.message || "Export failed.");
            if (failure?.summary) setResult(failure.summary);
        } finally { setIsExporting(false); }
    };
    return <div className="print-proof-modal-backdrop" role="dialog" aria-modal="true" aria-label="Export album" onClick={close}>
        <div className="print-proof-modal-container design-flow-dialog" onClick={event => event.stopPropagation()}>
            <div className="print-proof-modal-header"><h3>Export album</h3>
                <Button className="design-flow-action" disabled={isExporting} onClick={close}>Close</Button></div>
            <div className="print-proof-modal-body">
                <p>{preflight?.totalSheets || 0} spreads · Editable PSD + JPEG</p>
                <p>Uses each template’s dimensions and resolution. Check those in Photoshop before printing.</p>
                <p>Files are saved in the project output folders. Originals remain unchanged.</p>
                {!!preflight?.unfilledSlots && <p role="alert">Fill {preflight.unfilledSlots} empty photo slots before exporting.</p>}
                {preflight?.unfilledSlotDetails.map(item => <p key={item.sheetId}>{item.sheetLabel}: {item.assignedCount}/{item.totalCount} assigned ({item.missingCount} empty)</p>)}
                {preflight?.blockingIssues.map((issue, index) => <p role="alert" key={index}>{issue}</p>)}
                {isExporting && <div role="status">
                    <p>{stopping ? "Stopping safely…" : progress?.sheetLabel || "Preparing export…"}
                        {progress ? ` · ${progress.currentSheetIndex} / ${progress.totalSheets}` : ""}</p>
                    <progress max="100" value={progress?.percent || 0} />
                    <p>{progress?.sheetProgress?.batchProgress?.stage || ""}</p>
                </div>}
                {error && <p role="alert">{error}</p>}
                {result && <div role="status">
                    <p>{result.cancelled ? "Export stopped" : result.success ? "Export complete" : "Export needs attention"}:
                        {` ${result.successfulSheets} saved · ${result.failedSheets} failed · ${result.pendingSheets || 0} pending`}</p>
                    {result.results?.filter(item => item.status !== "SUCCESS").map(item =>
                        <p key={item.sheetId}>{item.sheetId}: {item.error || item.status}</p>)}
                </div>}
            </div>
            <div className="print-proof-modal-footer">
                {isExporting ? <Button className="design-flow-action" disabled={stopping} onClick={() => { setStopping(true); onCancel?.(); }}>Cancel export</Button>
                    : <Button className="design-flow-action" disabled={disabled || !preflight?.isReadyForPrint} onClick={run}>Export all spreads</Button>}
            </div>
        </div>
    </div>;
}
