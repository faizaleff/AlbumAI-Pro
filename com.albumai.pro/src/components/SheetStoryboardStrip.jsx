import { PsdPreviews } from "../services/TemplateDocumentReader";
import React from "react";
import SidebarButton from "./SidebarButton";

function MiniSpreadPreview({ slotCount = 1, filledCount = 0 }) {
    const slots = Array.from({ length: Math.max(1, Math.min(6, slotCount)) });

    return (
        <div className="storyboard-mini-spread">
            {slots.map((_, i) => (
                <div
                    key={i}
                    className={`mini-slot${i < filledCount ? " filled" : ""}`}
                />
            ))}
        </div>
    );
}

function StoryboardCard({
    sheet,
    index,
    totalSheets,
    template,
    isSelected,
    onSelect,
    onMove,
    onDuplicate,
    onRemove,
    disabled
}) {
    const assignedSlots = Array.isArray(sheet.slots) ? sheet.slots : [];
    const templateSlots = Array.isArray(template?.smartObjects) && template.smartObjects.length > 0
        ? template.smartObjects.length
        : (Number.isInteger(template?.slotCount) && template.slotCount > 0 ? template.slotCount : null);
    const totalSlots = templateSlots || (assignedSlots.length > 0 ? assignedSlots.length : 1);
    const filledCount = Math.min(assignedSlots.length, totalSlots);
    const isFull = filledCount >= totalSlots && totalSlots > 0;

    return (
        <div
            className={`storyboard-card${isSelected ? " is-selected" : ""}`}
            onClick={() => onSelect(sheet)}
        >
            <div className="storyboard-card-header">
                <span className="storyboard-sheet-number">#{index + 1}</span>
                <span className={`storyboard-fill-pill${isFull ? " is-full" : filledCount > 0 ? " is-partial" : ""}`}>
                    {filledCount}/{totalSlots}
                </span>
            </div>

            <MiniSpreadPreview
                slotCount={totalSlots}
                filledCount={filledCount}
            />

            <div className="storyboard-card-info">
                <span className="storyboard-sheet-label" title={sheet.label || sheet.id}>
                    {sheet.label || sheet.id}
                </span>
                <span className="storyboard-template-name" title={template?.name || sheet.templateId}>
                    {template?.name || sheet.templateId}
                </span>
                {Array.isArray(sheet.typographyAssignments) && sheet.typographyAssignments.length > 0 && (
                    <span className="storyboard-template-name" title="Typography assignments saved for this sheet">
                        Typography: {sheet.typographyAssignments.length}
                    </span>
                )}
            </div>

            <div className="storyboard-card-actions" onClick={e => e.stopPropagation()}>
                <button
                    type="button"
                    className="storyboard-action-btn"
                    onClick={() => onMove(sheet.id, index - 1)}
                    disabled={disabled || index === 0}
                    title="Move sheet left"
                >
                    ←
                </button>
                <button
                    type="button"
                    className="storyboard-action-btn"
                    onClick={() => onMove(sheet.id, index + 1)}
                    disabled={disabled || index === totalSheets - 1}
                    title="Move sheet right"
                >
                    →
                </button>
                <button
                    type="button"
                    className="storyboard-action-btn"
                    onClick={() => onDuplicate(sheet.id)}
                    disabled={disabled}
                    title="Duplicate sheet"
                >
                    +
                </button>
                <button
                    type="button"
                    className="storyboard-action-btn danger"
                    onClick={() => onRemove(sheet.id)}
                    disabled={disabled}
                    title="Delete sheet"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

export default function SheetStoryboardStrip({
    sheets = [],
    selectedSheetId,
    templates = [],
    onSelectSheet,
    onMoveSheet,
    onDuplicateSheet,
    onRemoveSheet,
    onAddSheet,
    disabled = false,
    compact = false,
    onRefresh, renderDraft, draftSheetId, draftSheetIds = [], renderBusy = false, refreshDisabled = disabled,
    projectId,
    photos = []
}) {
    const templateMap = new Map((templates || []).map(t => [t.id, t]));

    if (compact) {
        return <section className="design-storyboard" aria-label="Album spreads">
            <div className="design-storyboard-track">
                {sheets.map((sheet, index) => {
                    const resolved = PsdPreviews.resolve(projectId, sheet, templateMap.get(sheet.templateId), photos);
                    const templateImage = !sheet.slots?.length && PsdPreviews.get(PsdPreviews.key(projectId, null, templateMap.get(sheet.templateId)));
                    const image = templateImage?.status === "ready" ? templateImage : resolved.image;
                    const needsRefresh = (draftSheetId === sheet.id || draftSheetIds.includes(sheet.id)) || resolved.dirty || image?.status !== "ready";
                    return <div key={sheet.id} className="design-thumb-wrap" data-spread-card={sheet.id}><SidebarButton
                    className={"design-spread-thumb" + (sheet.id === selectedSheetId ? " is-selected" : "")}
                    disabled={disabled} aria-pressed={sheet.id === selectedSheetId}
                    aria-label={"Select spread " + (index + 1) + ": " + (sheet.label || sheet.id)} onClick={() => onSelectSheet(sheet)}>
                    <div className="design-spread-images">{(() => {
                        return renderDraft?.(sheet) || (image?.status === "ready" ? <img className="design-spread-render" src={image.src} alt="Rendered spread"/> : <span>Preview pending</span>);
                    })()}</div>
                    <span>{String(index + 1).padStart(2, "0")} · {sheet.label || sheet.id}</span>
                </SidebarButton>
                    {needsRefresh && <div className="design-thumb-stale" aria-hidden="true"/>}
                    {onRefresh && needsRefresh && <SidebarButton data-spread-action="refresh" className="design-thumb-refresh" aria-label="Refresh preview" title="Refresh preview"
                        disabled={refreshDisabled || renderBusy} onClick={() => onRefresh(sheet.id)}>↻</SidebarButton>}
                    {onRemoveSheet && <SidebarButton data-spread-action="remove" className="design-thumb-remove"
                        aria-label={"Remove spread " + (index + 1)} title="Remove spread" disabled={disabled}
                        onClick={() => onRemoveSheet(sheet.id)}>×</SidebarButton>}
                </div>; })}
                {onAddSheet && <SidebarButton className="design-spread-add" disabled={disabled} onClick={onAddSheet}>+ Add spread</SidebarButton>}
            </div>
        </section>;
    }

    return (
        <section className="storyboard-strip-container" aria-label="Album Sheet Storyboard">
            <div className="storyboard-strip-header">
                <div className="storyboard-title-group">
                    <strong>Sheet Storyboard</strong>
                    <span className="storyboard-sheet-count">
                        {sheets.length} {sheets.length === 1 ? "sheet" : "sheets"}
                    </span>
                </div>
            </div>

            <div className="storyboard-scroll-track">
                {sheets.map((sheet, index) => {
                    const template = templateMap.get(sheet.templateId);
                    const isSelected = selectedSheetId === sheet.id;

                    return (
                        <StoryboardCard
                            key={sheet.id}
                            sheet={sheet}
                            index={index}
                            totalSheets={sheets.length}
                            template={template}
                            isSelected={isSelected}
                            onSelect={onSelectSheet}
                            onMove={onMoveSheet}
                            onDuplicate={onDuplicateSheet}
                            onRemove={onRemoveSheet}
                            disabled={disabled}
                        />
                    );
                })}

                {onAddSheet && (
                    <button
                        type="button"
                        className="storyboard-add-card"
                        onClick={onAddSheet}
                        disabled={disabled}
                        title="Add a new Album Sheet"
                    >
                        <span className="add-icon">+</span>
                        <span className="add-text">Add Sheet</span>
                    </button>
                )}
            </div>
        </section>
    );
}
