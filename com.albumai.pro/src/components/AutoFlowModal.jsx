import UxpDropdown from "./UxpDropdown";
import Button from "./SidebarButton";
import React, { useState, useMemo } from "react";
import { AutoFlowStrategy, generateAutoFlowSpreads, getTemplateSlotCapacity } from "../services/PhotoAutoFlowEngine";

export default function AutoFlowModal({ isOpen = false, onClose, photos = [], templates = [],
    existingSheetCount = 0, onApplyAutoFlow, disabled = false }) {
    const [density, setDensity] = useState("TEMPLATE");
    const [isBusy, setIsBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const capacities = templates.filter(template => template?.id && Array.isArray(template.smartObjects))
        .map(getTemplateSlotCapacity).filter(count => count > 0);
    const maxPhotosPerSpread = density === "TEMPLATE" ? Math.max(1, ...capacities) : Number(density);
    const densityOptions = [{value: "TEMPLATE", label: "Templates in order"},
        ...[...new Set([1, 2, 3, 4, 5, 6, ...capacities])].sort((a, b) => a - b)
            .map(count => ({value: String(count), label: String(count)}))];
    const options = { strategy: AutoFlowStrategy.LIBRARY_ORDER, maxPhotosPerSpread, templateOrder: density === "TEMPLATE" };
    const preview = useMemo(() => isOpen ? generateAutoFlowSpreads({ photos, templates,
        options: { strategy: AutoFlowStrategy.LIBRARY_ORDER, maxPhotosPerSpread, templateOrder: density === "TEMPLATE" } }) : null,
    [isOpen, photos, templates, maxPhotosPerSpread, density]);
    const incompleteSpreads = (preview?.sheets || []).map((sheet, index) => ({
        number: index + 1,
        emptySlots: Math.max(0, getTemplateSlotCapacity(templates.find(template => template.id === sheet.templateId)) - sheet.slots.length)
    })).filter(sheet => sheet.emptySlots > 0);
    const emptySlotCount = incompleteSpreads.reduce((total, sheet) => total + sheet.emptySlots, 0);
    if (!isOpen) return null;
    const close = () => { if (!isBusy) { setErrorMessage(null); onClose(); } };
    const generate = async append => {
        if (isBusy || disabled || !preview?.success) return;
        setIsBusy(true);
        setErrorMessage(null);
        try {
            const result = generateAutoFlowSpreads({ photos, templates, options: {
                ...options, startIndex: append ? existingSheetCount + 1 : 1
            } });
            if (!result.success) throw new Error("Add a template with photo slots.");
            await onApplyAutoFlow(result.sheets, append);
            onClose();
        } catch (error) { setErrorMessage(error?.message || "Could not save spreads."); }
        finally { setIsBusy(false); }
    };
    return <div className="autoflow-modal-backdrop" role="dialog" aria-modal="true" aria-label="Arrange photos" onClick={close}>
        <div className="autoflow-modal-container design-flow-dialog" onClick={event => event.stopPropagation()}>
            <div className="autoflow-modal-header"><h3>Arrange photos</h3>
                <Button className="design-flow-action" onClick={close} disabled={isBusy}>Close</Button></div>
            <div className="autoflow-modal-body">
                <p>{photos.length} final photos · Excludes rejected photos.</p>
                <p>Apply all renders drafts.</p>
                <label>Photos per spread
                    <UxpDropdown value={density} disabled={isBusy || disabled}
                        ariaLabel="Photos per spread" onValueChange={setDensity}
                        options={densityOptions} />
                </label>
                <p>{density === "TEMPLATE" ? "Cycles templates in panel order." : "Uses best-fitting template."}</p>
                {preview?.success ? <div>
                    <p>{preview.summary.totalSheets} spreads · {preview.summary.totalPhotosPlaced} photos placed.</p>
                    {emptySlotCount > 0 ? <p>{emptySlotCount} empty {emptySlotCount === 1 ? "slot" : "slots"} across {incompleteSpreads.length} {incompleteSpreads.length === 1 ? "spread" : "spreads"}.
                        {incompleteSpreads.length === 1 && ` Spread ${incompleteSpreads[0].number} needs ${emptySlotCount} more ${emptySlotCount === 1 ? "photo" : "photos"}.`}
                        {" Fill empty slots before export."}</p>
                        : <p>All template slots filled.</p>}
                </div>
                    : <p>Add photos and a template to continue.</p>}
                {errorMessage && <p role="alert">{errorMessage}</p>}
            </div>
            <div className="autoflow-modal-footer">
                {existingSheetCount > 0 && <Button className="design-flow-action" disabled={disabled || isBusy || !preview?.success}
                    onClick={() => generate(true)}>Add spreads</Button>}
                <Button className="design-flow-action" disabled={disabled || isBusy || !preview?.success} onClick={() => generate(false)}>
                    {isBusy ? "Preparing preview…" : existingSheetCount ? "Replace existing spreads" : "Create spreads"}</Button>
            </div>
        </div>
    </div>;
}
