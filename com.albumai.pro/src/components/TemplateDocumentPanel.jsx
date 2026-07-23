import React, { useEffect, useState } from "react";

function LayerTree({ layers = [], depth = 0 }) {

    return (

        <ul
            style={{
                margin: 0,
                paddingLeft: depth ? 16 : 0,
                listStyle: "none"
            }}
        >

            {layers.map(layer => (
                <li key={layer.id} style={{ marginTop: 4 }}>
                    <span>
                        {layer.children.length ? "Group" : "Layer"}: {layer.name}
                    </span>
                    {layer.children.length > 0 && (
                        <LayerTree
                            layers={layer.children}
                            depth={depth + 1}
                        />
                    )}
                </li>
            ))}

        </ul>

    );

}

function textPreview(text) {

    if (typeof text !== "string") {
        return "—";
    }

    return text.length > 80
        ? `${text.slice(0, 80)}…`
        : text;

}

function fileName(value) {

    if (typeof value !== "string" || !value) {
        return "—";
    }

    return value.split(/[\\/]/).pop() || "—";

}

function textValue(value, fallback = "—") {

    return value === null || value === undefined || value === ""
        ? fallback
        : String(value);

}

function addList(lines, heading, items) {

    lines.push(heading);

    if (!items.length) {
        lines.push("None");
        lines.push("");
        return;
    }

    items.forEach(item => lines.push(`- ${item}`));
    lines.push("");

}

function summaryText({
    hasProject,
    projectId,
    projectName,
    photos,
    healthTemplate,
    document,
    placementPlan,
    executionPlan,
    autoSaveEnabled,
    autoSaveMode,
    autoSaveResult,
    exportEnabled,
    exportFormat,
    exportResult,
    executionSummary,
    batchProgress,
    executionLifecycle,
    projectExecutionSummary,
    registeredTemplates = []
}) {

    const selectedCount = photos.filter(photo => photo?.selected).length;
    const template = document || healthTemplate;
    const lines = [
        "AlbumAI Summary",
        `Generated: ${new Date().toISOString()}`,
        "",
        "Project",
        `Status: ${hasProject ? "READY" : "MISSING"}`,
        `ID: ${textValue(projectId)}`,
        `Name: ${textValue(projectName)}`,
        `Photos: ${photos.length}`,
        `Selected: ${selectedCount}`,
        "",
        "Template",
        `Name: ${textValue(template?.name)}`,
        `Smart Objects: ${template?.smartObjects?.length || 0}`,
        "",
        "Project Template Registry",
        `Registered Templates: ${registeredTemplates.length}`,
        "Registry Order:",
        ...(registeredTemplates.length
            ? registeredTemplates.map((entry, index) => `${index + 1}. ${entry.name}`)
            : ["None"]),
        "",
        "Placement",
        `Assigned: ${placementPlan?.statistics?.assignedSlots || 0}`,
        `Empty: ${placementPlan?.statistics?.emptySlots || 0}`,
        `Unassigned: ${placementPlan?.statistics?.unassignedPhotos || 0}`,
        "",
        "Execution",
        `Plan Status: ${executionPlan?.status || "NOT READY"}`,
        `Ready Steps: ${executionPlan?.statistics?.readySteps || 0}`,
        `Completed: ${batchProgress?.completedSteps ?? executionSummary?.completedSteps ?? 0}`,
        `Success: ${batchProgress?.successCount ?? executionSummary?.completedSteps ?? 0}`,
        `Failed: ${batchProgress?.failedCount ?? executionSummary?.failedSteps ?? 0}`,
        `Lifecycle: ${executionLifecycle?.status || "IDLE"}`,
        "",
        "Auto Save",
        `Enabled: ${autoSaveEnabled ? "ON" : "OFF"}`,
        `Mode: ${autoSaveMode === "SAVE_COPY" ? "Save Copy" : "Overwrite Original"}`,
        `Result: ${autoSaveResult?.status || "NOT RUN"}`,
        `Output: ${fileName(autoSaveResult?.outputPath)}`,
        "",
        "Export",
        `Enabled: ${exportEnabled ? "ON" : "OFF"}`,
        `Format: ${exportFormat}`,
        `Result: ${exportResult?.status || "NOT RUN"}`,
        `Output: ${fileName(exportResult?.outputPath)}`
    ];

    if (projectExecutionSummary) {
        lines.push(
            "",
        "Project Execution",
        `Status: ${projectExecutionSummary.status}`,
            `Registered Templates: ${registeredTemplates.length}`,
            `Batch Status: ${projectExecutionSummary.batchExecution?.status || "NOT STARTED"}`,
            `Current Stage: ${projectExecutionSummary.batchProgress?.stage || "IDLE"}`,
            `Template: ${projectExecutionSummary.batchProgress?.templateIndex == null ? "—" : `${projectExecutionSummary.batchProgress.templateIndex + 1} / ${projectExecutionSummary.batchProgress.totalTemplates}`}`,
            `Remaining Templates: ${projectExecutionSummary.batchProgress?.remainingTemplates ?? 0}`,
            `Progress: ${projectExecutionSummary.batchProgress?.percentage ?? 0}%`,
            `Completed Templates: ${projectExecutionSummary.completedTemplates}`,
            `Successful Templates: ${projectExecutionSummary.successfulTemplates}`,
            `Failed Templates: ${projectExecutionSummary.failedTemplates}`
        );
    }

    return lines.join("\n");

}

function debugText({
    projectId,
    projectName,
    photos,
    healthTemplate,
    document,
    placementPlan,
    executionPlan,
    replacementRequest,
    batchProgress,
    executionSummary,
    executionLifecycle,
    autoSaveResult,
    exportResult,
    projectExecutionSummary,
    placementError,
    registeredTemplates = [],
    registryError = null
}) {

    const template = document || healthTemplate;
    const selectedPhotos = photos.filter(photo => photo?.selected);
    const slots = template?.smartObjects || [];
    const photoNameById = new Map(photos.map(photo => [photo?.id, photo?.name]));
    const photoName = (photoId, fallback = "") =>
        fileName(photoNameById.get(photoId) || fallback);
    const lines = [
        "AlbumAI Debug Log",
        `Generated: ${new Date().toISOString()}`,
        "",
        "Project",
        `ID: ${textValue(projectId)}`,
        `Name: ${textValue(projectName)}`,
        "",
        "Template",
        `ID: ${textValue(template?.id)}`,
        `Document ID: ${textValue(template?.document?.id)}`,
        `Name: ${textValue(template?.name)}`,
        ""
    ];

    addList(lines, "Selected Photos", selectedPhotos.map(photo =>
        photoName(photo?.id, photo?.name)
    ));
    addList(lines, "Smart Object Slots", slots.map(slot =>
        `${textValue(slot?.layerId)} — ${textValue(slot?.layerName)}`
    ));
    addList(lines, "Placement Assignments", (placementPlan?.assignments || []).map(assignment =>
        `photo=${photoName(assignment?.photoId, assignment?.photoName)}, slot=${textValue(assignment?.slotLayerId ?? assignment?.layerId)}, fit=${textValue(assignment?.fitMode)}`
    ));
    addList(lines, "Execution Plan Steps", (executionPlan?.steps || []).map(step =>
        `#${textValue(step?.order)} photo=${photoName(step?.photoId, step?.photoName)}, slot=${textValue(step?.slotLayerId)} (${textValue(step?.slotName)})`
    ));
    addList(lines, "Replacement Request Steps", (replacementRequest?.steps || []).map(step =>
        `#${textValue(step?.stepNumber)} photo=${photoName(step?.photoId, step?.photoName)}, slot=${textValue(step?.slotLayerId)} (${textValue(step?.slotName)})`
    ));

    lines.push(
        "Batch Progress",
        `Status: ${textValue(batchProgress?.status)}`,
        `Completed: ${textValue(batchProgress?.completedSteps, "0")} / ${textValue(batchProgress?.totalSteps, "0")}`,
        `Success: ${textValue(batchProgress?.successCount, "0")}`,
        `Failed: ${textValue(batchProgress?.failedCount, "0")}`,
        "",
        "Execution Summary",
        `Status: ${textValue(executionSummary?.status)}`,
        `Completed: ${textValue(executionSummary?.completedSteps, "0")}`,
        `Failed: ${textValue(executionSummary?.failedSteps, "0")}`,
        `Lifecycle: ${textValue(executionLifecycle?.status, "IDLE")}`,
        `Lifecycle Error: ${textValue(executionLifecycle?.error, "None")}`,
        "",
        "Auto Save Result",
        `Status: ${textValue(autoSaveResult?.status)}`,
        `Output: ${fileName(autoSaveResult?.outputPath)}`,
        `Warnings: ${(autoSaveResult?.warnings || []).join(" | ") || "None"}`,
        `Error: ${textValue(autoSaveResult?.error, "None")}`,
        "",
        "Export Result",
        `Status: ${textValue(exportResult?.status)}`,
        `Output: ${fileName(exportResult?.outputPath)}`,
        `Warnings: ${(exportResult?.warnings || []).join(" | ") || "None"}`,
        `Error: ${textValue(exportResult?.error, "None")}`,
        "",
        "Project Execution Summary",
        `Status: ${textValue(projectExecutionSummary?.status)}`,
        `Registered Templates: ${registeredTemplates.length}`,
        `Completed Templates: ${textValue(projectExecutionSummary?.completedTemplates, "0")}`,
        `Successful Templates: ${textValue(projectExecutionSummary?.successfulTemplates, "0")}`,
        `Failed Templates: ${textValue(projectExecutionSummary?.failedTemplates, "0")}`,
        `Batch Status: ${textValue(projectExecutionSummary?.batchExecution?.status)}`,
        `Current Template: ${textValue(projectExecutionSummary?.batchExecution?.currentTemplate?.name)}`,
        `Batch Warning: ${textValue(projectExecutionSummary?.batchExecution?.warnings?.[0], "None")}`,
        `Batch Fatal Error: ${textValue(projectExecutionSummary?.batchExecution?.fatalError, "None")}`,
        `Batch Lifecycle: ${textValue(projectExecutionSummary?.batchProgress?.lifecycle, "IDLE")}`,
        `Current Stage: ${textValue(projectExecutionSummary?.batchProgress?.stage, "IDLE")}`,
        `Template Index: ${projectExecutionSummary?.batchProgress?.templateIndex == null ? "—" : `${projectExecutionSummary.batchProgress.templateIndex + 1} / ${projectExecutionSummary.batchProgress.totalTemplates}`}`,
        `Remaining Templates: ${textValue(projectExecutionSummary?.batchProgress?.remainingTemplates, "0")}`,
        `Progress: ${textValue(projectExecutionSummary?.batchProgress?.percentage, "0")}%`,
        `Registry Validation: ${textValue(projectExecutionSummary?.registryValidationError, "None")}`,
        "Registry Order:",
        ...(registeredTemplates.length ? registeredTemplates : [{ name: "None" }]).map((template, index) =>
            `${index + 1}. ${textValue(template.id)} — ${textValue(template.name)}: ${textValue(template.validationState)}`
        ),
        "Per-template Batch Outcomes",
        ...(projectExecutionSummary?.batchExecution?.templateResults || []).map(result =>
            `${textValue(result.templateId)} — ${textValue(result.templateName)} [document=${textValue(result.documentContext?.documentId)}]: ${textValue(result.status)}${result.error ? ` (${result.error})` : ""}`
        ),
        "",
        "Stored Warnings and Errors",
        `Registry: ${textValue(registryError || projectExecutionSummary?.registryValidationError, "None")}`,
        `Placement: ${textValue(placementError, "None")}`,
        `Placement Warnings: ${(placementPlan?.warnings || []).map(warning => warning?.message || String(warning)).join(" | ") || "None"}`,
        `Execution Warnings: ${(executionPlan?.warnings || []).map(warning => warning?.message || String(warning)).join(" | ") || "None"}`
    );

    return lines.join("\n");

}

export function ExecutionDetails({
    hasProject,
    projectId,
    projectName,
    healthPhotos,
    healthTemplate,
    placementPlan,
    placementError,
    executionPlan,
    replacementRequest,
    document,
    autoSaveEnabled,
    autoSaveMode,
    autoSaveResult,
    exportEnabled,
    exportFormat,
    exportResult,
    replacementResult,
    executionSummary,
    batchProgress,
    executionLifecycle,
    projectExecutionSummary,
    registeredTemplates = [],
    registryError = null
}) {

    const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
    const [layerListOpen, setLayerListOpen] = useState(false);
    const [detailSections, setDetailSections] = useState({
        autoSave: false,
        export: false,
        template: false,
        placement: false,
        executionPlan: true,
        batchProgress: true
    });
    const [copyFeedback, setCopyFeedback] = useState("");
    const sectionStyle = {
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px solid #4a4a4a",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box"
    };
    const titleStyle = {
        margin: 0,
        fontSize: 15,
        fontWeight: 700
    };
    const rowStyle = {
        display: "flex",
        gap: 8,
        alignItems: "baseline",
        marginTop: 8,
        lineHeight: 1.35,
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box"
    };
    const labelStyle = {
        flex: "0 0 108px",
        color: "#b8b8b8",
        fontSize: 12
    };
    const valueStyle = {
        flex: "1 1 0",
        minWidth: 0,
        maxWidth: "100%",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        whiteSpace: "normal",
        fontSize: 13
    };
    const Row = ({ label, value, warning = false }) => (
        <div style={{ ...rowStyle, color: warning ? "#ffcc99" : undefined }}>
            <span style={labelStyle}>{label}</span>
            <span style={valueStyle}>{value}</span>
        </div>
    );
    const Toggle = ({ open, onClick, children }) => (
        <button
            type="button"
            onClick={onClick}
            style={{ marginTop: 8, fontSize: 12 }}
        >
            {open ? "Hide" : "Show"} {children}
        </button>
    );
    const DetailSection = ({ id, title, children }) => {
        const open = detailSections[id];

        return (
            <div style={sectionStyle}>
                <button
                    type="button"
                    onClick={() => setDetailSections(value => ({ ...value, [id]: !open }))}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0, background: "transparent", border: 0, color: "#fff", cursor: "pointer" }}
                >
                    <span style={titleStyle}>{title}</span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>{open ? "−" : "+"}</span>
                </button>
                {open && children}
            </div>
        );
    };
    const copy = async (content, successMessage) => {

        try {

            if (typeof navigator?.clipboard?.writeText !== "function") {
                throw new Error("Clipboard is unavailable.");
            }

            await navigator.clipboard.writeText(content);
            setCopyFeedback(successMessage);

        }

        catch (_) {

            setCopyFeedback("Clipboard access is unavailable. Reload the plugin and allow clipboard access.");

        }

    };
    const copySummary = () => copy(summaryText({
        hasProject,
        projectId,
        projectName,
        photos: healthPhotos,
        healthTemplate,
        document,
        placementPlan,
        executionPlan,
        autoSaveEnabled,
        autoSaveMode,
        autoSaveResult,
        exportEnabled,
        exportFormat,
        exportResult,
        executionSummary,
        batchProgress,
        executionLifecycle,
        projectExecutionSummary,
        registeredTemplates
    }), "Summary copied.");
    const copyDebugLog = () => copy(debugText({
        projectId,
        projectName,
        photos: healthPhotos,
        healthTemplate,
        document,
        placementPlan,
        executionPlan,
        replacementRequest,
        batchProgress,
        executionSummary,
        executionLifecycle,
        autoSaveResult,
        exportResult,
        projectExecutionSummary,
        placementError,
        registeredTemplates,
        registryError
    }), "Debug log copied.");

    return (
        <section style={{ marginTop: 20, paddingBottom: 16, minWidth: 0, maxWidth: "100%", boxSizing: "border-box", overflowWrap: "anywhere", wordBreak: "break-word" }}>
            <h3 style={titleStyle}>Execution Details</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={copySummary} style={{ minHeight: 30, padding: "4px 10px" }}>Copy Summary</button>
                <button type="button" onClick={copyDebugLog} style={{ minHeight: 30, padding: "4px 10px" }}>Copy Debug Log</button>
            </div>
            {copyFeedback && <div style={{ marginTop: 8, fontSize: 12, color: "#b8dca0" }}>{copyFeedback}</div>}

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Project Health</h4>
                <Row label="Project" value={hasProject ? "READY" : "MISSING"} />
                <Row label="Photos" value={healthPhotos.length} />
                <Row label="Template" value={healthTemplate ? "READY" : "MISSING"} />
                <Row label="Registered Templates" value={registeredTemplates.length} />
                {registryError && <Row label="Registry Warning" value={registryError} warning />}
                <Row label="Smart Objects" value={healthTemplate?.smartObjects?.length || 0} />
                <Row label="Placement" value={placementPlan ? "READY" : "NOT READY"} />
                <Row label="Execution Plan" value={executionPlan?.status === "READY" ? "READY" : "NOT READY"} />
                <Row label="Replacement Request" value={replacementRequest ? "READY" : "NOT READY"} />
            </div>

            <DetailSection id="autoSave" title="Auto Save">
                <Row label="Enabled" value={autoSaveEnabled ? "ON" : "OFF"} />
                <Row label="Mode" value={autoSaveMode === "SAVE_COPY" ? "Save Copy" : "Overwrite Original"} />
                {autoSaveResult && <Row label="Last Result" value={autoSaveResult.status} />}
                {!!autoSaveResult?.outputPath && <Row label="Output" value={autoSaveResult.outputPath} />}
                {!!autoSaveResult?.warnings?.length && <Row label="Warning" value={autoSaveResult.warnings.join(" ")} warning />}
                {autoSaveResult?.error && <Row label="Warning" value={autoSaveResult.error} warning />}
            </DetailSection>

            <DetailSection id="export" title="Export">
                <Row label="Enabled" value={exportEnabled ? "ON" : "OFF"} />
                <Row label="Format" value={exportFormat} />
                {exportResult && <Row label="Last Export" value={exportResult.status} />}
                {!!exportResult?.outputPath && <Row label="Output" value={exportResult.outputPath} />}
                {!!exportResult?.warnings?.length && <Row label="Warning" value={exportResult.warnings.join(" ")} warning />}
                {exportResult?.error && <Row label="Warning" value={exportResult.error} warning />}
            </DetailSection>

            <DetailSection id="template" title="Template">
                <Row label="Name" value={document?.name || "No template open"} />
                {document && <>
                    <Toggle open={templateDetailsOpen} onClick={() => setTemplateDetailsOpen(open => !open)}>Template Details</Toggle>
                    {templateDetailsOpen && <div>
                        <Row label="Dimensions" value={`${document.document.width} × ${document.document.height}`} />
                        <Row label="Resolution" value={document.document.resolution} />
                        <Row label="Layer Count" value={document.statistics.totalLayers} />
                        <Row label="Smart Objects" value={document.statistics.totalSmartObjects} />
                        <Row label="Text Layers" value={document.statistics.totalTextLayers} />
                        {!!document.smartObjects?.length && <Row label="Smart Object Names" value={document.smartObjects.map(layer => layer.layerName).join(", ")} />}
                        {!!document.textLayers?.length && <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>
                            {document.textLayers.map(layer => <div key={layer.layerId}>{layer.layerName}: {textPreview(layer.textContent)}</div>)}
                        </div>}
                    </div>}
                    {document.layerTree && <>
                        <Toggle open={layerListOpen} onClick={() => setLayerListOpen(open => !open)}>Layer List</Toggle>
                        {layerListOpen && <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4 }}><LayerTree layers={document.layerTree} /></div>}
                    </>}
                </>}
            </DetailSection>

            <DetailSection id="placement" title="Placement">
                {placementPlan ? <>
                    <Row label="Assigned Slots" value={placementPlan.statistics.assignedSlots} />
                    <Row label="Empty Slots" value={placementPlan.statistics.emptySlots} />
                    <Row label="Unassigned Photos" value={placementPlan.statistics.unassignedPhotos} />
                    <Row label="Warnings" value={placementPlan.warnings.length} />
                </> : <Row label="Status" value="NOT READY" />}
                {placementError && <Row label="Warning" value={placementError} warning />}
            </DetailSection>

            <DetailSection id="executionPlan" title="Execution Plan">
                <Row label="Lifecycle" value={executionLifecycle?.status || "IDLE"} />
                {executionLifecycle?.error && <Row label="Error" value={executionLifecycle.error} warning />}
                {executionPlan ? <>
                    <Row label="Ready Steps" value={executionPlan.statistics.readySteps} />
                    <Row label="Warnings" value={executionPlan.statistics.warningCount} />
                    <Row label="Status" value={executionPlan.status} />
                </> : <Row label="Status" value="NOT READY" />}
                {replacementResult && <Row label="Replacement" value={replacementResult.status} />}
                {!!replacementResult?.errors?.length && <Row label="Error" value={replacementResult.errors.join(" ")} warning />}
                {executionSummary && <>
                    <Row label="Batch Success" value={executionSummary.completedSteps} />
                    <Row label="Batch Failed" value={executionSummary.failedSteps} />
                </>}
            </DetailSection>

            <DetailSection id="batchProgress" title="Batch Progress">
                {batchProgress ? <>
                    <Row label="Status" value={batchProgress.status} />
                    <Row label="Current Photo" value={batchProgress.currentPhotoName || "—"} />
                    <Row label="Current Slot" value={batchProgress.currentSlotName || "—"} />
                    <Row label="Completed" value={`${batchProgress.completedSteps} / ${batchProgress.totalSteps}`} />
                    <Row label="Success" value={batchProgress.successCount} />
                    <Row label="Failed" value={batchProgress.failedCount} />
                </> : <Row label="Status" value="IDLE" />}
                {projectExecutionSummary && <>
                    {(() => {
                        const progress = projectExecutionSummary.batchProgress || {};
                        return <>
                    <Row label="Status" value={progress.lifecycle || "IDLE"} />
                    <Row label="Registered" value={registeredTemplates.length} />
                    <Row label="Current Template" value={progress.currentTemplate?.name || "—"} />
                    <Row label="Template" value={progress.templateIndex == null ? "—" : `${progress.templateIndex + 1} / ${progress.totalTemplates}`} />
                    <Row label="Current Stage" value={progress.stage || "IDLE"} />
                    <Row label="Completed" value={progress.completedTemplates || 0} />
                    <Row label="Success" value={progress.successfulTemplates || 0} />
                    <Row label="Failed" value={progress.failedTemplates || 0} />
                    <Row label="Remaining" value={progress.remainingTemplates || 0} />
                    <Row label="Progress" value={`${progress.percentage || 0}%`} />
                    <div style={{ height: 6, background: "#4a4a4a", borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, progress.percentage || 0))}%`, height: "100%", background: "#3B82F6" }} />
                    </div>
                    {projectExecutionSummary.registryValidationError && <Row label="Warning" value={projectExecutionSummary.registryValidationError} warning />}
                        </>;
                    })()}
                </>}
            </DetailSection>
        </section>
    );

}

export default function TemplateDocumentPanel({
    loadTemplates,
    getRegisteredProjectTemplates,
    addCurrentPsdToProject,
    removeRegisteredProjectTemplate,
    openTemplate,
    planPhotoPlacement,
    getCurrentPlacementPlan,
    buildPlacementExecutionPlan,
    getCurrentPlacementExecutionPlan,
    getCurrentReplacementRequest,
    executeReplacementStep,
    executeReplacementBatch,
    getCurrentExecutionSummary,
    getCurrentBatchProgress,
    getCurrentExecutionLifecycle,
    executeProject,
    getCurrentProjectExecutionSummary,
    getPhotos,
    getCurrentTemplate,
    setAutoSaveEnabled,
    getAutoSaveEnabled,
    setAutoSaveMode,
    getAutoSaveMode,
    getCurrentAutoSaveResult,
    setExportEnabled,
    getExportEnabled,
    setExportFormat,
    getExportFormat,
    getCurrentExportResult,
    onExecutionDetailsChange,
    projectId = null,
    projectName = "",
    hasProject = false
}) {

    const [templates, setTemplates] = useState([]);
    const [selectedName, setSelectedName] = useState("");
    const [registeredTemplates, setRegisteredTemplates] = useState([]);
    const [selectedRegisteredId, setSelectedRegisteredId] = useState("");
    const [registryError, setRegistryError] = useState(null);
    const [document, setDocument] = useState(null);
    const [, setPlacementVersion] = useState(0);
    const [placementError, setPlacementError] = useState(null);
    const [replacementResult, setReplacementResult] = useState(null);
    const [executionSummary, setExecutionSummary] = useState(null);
    const [batchProgress, setBatchProgress] = useState(() =>
        getCurrentBatchProgress?.() || null
    );
    const [executionLifecycle, setExecutionLifecycle] = useState(() =>
        getCurrentExecutionLifecycle?.() || null
    );
    const [projectExecutionSummary, setProjectExecutionSummary] = useState(null);
    const [autoSaveResult, setAutoSaveResult] = useState(() =>
        getCurrentAutoSaveResult?.() || null
    );
    const [exportResult, setExportResult] = useState(() =>
        getCurrentExportResult?.() || null
    );

    const placementPlan = getCurrentPlacementPlan?.() || null;
    const executionPlan = getCurrentPlacementExecutionPlan?.() || null;
    const replacementRequest = getCurrentReplacementRequest?.() || null;
    const healthPhotos = getPhotos?.() || [];
    const healthTemplate = getCurrentTemplate?.() || null;
    const autoSaveEnabled = getAutoSaveEnabled?.() || false;
    const autoSaveMode = getAutoSaveMode?.() || "SAVE_COPY";
    const exportEnabled = getExportEnabled?.() || false;
    const exportFormat = getExportFormat?.() || "JPEG";
    const isExecuting = executionLifecycle?.status === "RUNNING" ||
        projectExecutionSummary?.batchProgress?.lifecycle === "RUNNING";

    function refreshRegisteredTemplates() {
        const entries = getRegisteredProjectTemplates?.() || [];
        setRegisteredTemplates(entries);
        setSelectedRegisteredId(current => entries.some(entry => entry.id === current)
            ? current
            : (entries[0]?.id || ""));
    }

    useEffect(() => {

        onExecutionDetailsChange?.(
            <ExecutionDetails
                hasProject={hasProject}
                projectId={projectId}
                projectName={projectName}
                healthPhotos={healthPhotos}
                healthTemplate={healthTemplate}
                placementPlan={placementPlan}
                placementError={placementError}
                executionPlan={executionPlan}
                replacementRequest={replacementRequest}
                document={document}
                autoSaveEnabled={autoSaveEnabled}
                autoSaveMode={autoSaveMode}
                autoSaveResult={autoSaveResult}
                exportEnabled={exportEnabled}
                exportFormat={exportFormat}
                exportResult={exportResult}
                replacementResult={replacementResult}
                executionSummary={executionSummary}
                batchProgress={batchProgress}
                executionLifecycle={executionLifecycle}
                projectExecutionSummary={projectExecutionSummary}
                registeredTemplates={registeredTemplates}
                registryError={registryError}
            />
        );

    }, [
        hasProject,
        projectId,
        projectName,
        healthPhotos.length,
        healthTemplate,
        placementPlan,
        placementError,
        executionPlan,
        replacementRequest,
        document,
        autoSaveEnabled,
        autoSaveMode,
        autoSaveResult,
        exportEnabled,
        exportFormat,
        exportResult,
        replacementResult,
        executionSummary,
        batchProgress,
        executionLifecycle,
        projectExecutionSummary,
        registeredTemplates,
        registryError,
        onExecutionDetailsChange
    ]);

    useEffect(() => {

        async function load() {

            if (!hasProject) {
                setTemplates([]);
                setSelectedName("");
                return;
            }

            try {

                const files = await loadTemplates();

                setTemplates(files);
                setSelectedName(files[0]?.name || "");
                refreshRegisteredTemplates();

            }

            catch (_) {

                setTemplates([]);
                setSelectedName("");
                refreshRegisteredTemplates();

            }

        }

        load();

    }, [loadTemplates, hasProject]);

    async function addCurrentPsd() {
        const file = templates.find(item => item.name === selectedName);
        if (!file) return;
        try {
            await addCurrentPsdToProject?.(file);
            refreshRegisteredTemplates();
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        }
    }

    async function removeSelectedRegisteredTemplate() {
        if (!selectedRegisteredId) return;
        try {
            await removeRegisteredProjectTemplate?.(selectedRegisteredId);
            refreshRegisteredTemplates();
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        }
    }

    useEffect(() => {

        if (!hasProject) {
            setDocument(null);
            setRegistryError(null);
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setProjectExecutionSummary(null);
            setAutoSaveResult(null);
            setExportResult(null);
        }

        else if (!replacementRequest) {
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
        }

    }, [hasProject, replacementRequest]);

    async function open() {

        const file = templates.find(
            item => item.name === selectedName
        );

        if (!file) {
            return;
        }

        const result = await openTemplate(file);

        setDocument(result);
        setPlacementError(null);
        setReplacementResult(null);
        setExecutionSummary(null);
        setBatchProgress(getCurrentBatchProgress?.() || null);
        setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
        setProjectExecutionSummary(null);
        setAutoSaveResult(null);
        setExportResult(null);
        setPlacementVersion(value => value + 1);

    }

    function planPlacement() {

        if (isExecuting) return;

        try {

            planPhotoPlacement?.();
            setPlacementError(null);
            setProjectExecutionSummary(null);
            setAutoSaveResult(null);
            setExportResult(null);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setPlacementError(error.message);

        }

    }

    function buildExecutionPlan() {

        if (isExecuting) return;

        try {

            buildPlacementExecutionPlan?.();
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setProjectExecutionSummary(null);
            setAutoSaveResult(null);
            setExportResult(null);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setPlacementError(error.message);
            setReplacementResult({
                status: "FAILED",
                errors: [`Replacement request: ${error.message}`]
            });

        }

    }

    async function executeFirstReplacementStep() {

        const step = replacementRequest?.steps?.[0];

        if (!step) {
            setReplacementResult({
                status: "FAILED",
                errors: ["A replacement request with at least one step is required."]
            });
            return;
        }

        try {

            const result = await executeReplacementStep(step);

            setReplacementResult(result);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setReplacementResult({
                status: "FAILED",
                errors: [error.message]
            });

        }

    }

    async function executeReplacementBatchRequest() {

        try {

            setReplacementResult(null);
            setExecutionLifecycle({ status: "RUNNING" });
            const summary = await executeReplacementBatch(progress => {
                setBatchProgress(progress);
                setExecutionLifecycle(getCurrentExecutionLifecycle?.() || { status: "RUNNING" });
            });

            setExecutionSummary(summary || getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setPlacementVersion(value => value + 1);

        }

        catch (error) {

            setExecutionSummary(getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            setExecutionLifecycle(getCurrentExecutionLifecycle?.() || null);
            setReplacementResult({ status: "FAILED", errors: [error.message] });

        }

    }

    async function executeProjectRequest() {

        try {

            const summary = await executeProject(nextSummary => {
                setProjectExecutionSummary(nextSummary);
            });

            setProjectExecutionSummary(
                summary || getCurrentProjectExecutionSummary?.() || null
            );
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);

        }

        catch (_) {

            setProjectExecutionSummary(
                getCurrentProjectExecutionSummary?.() || null
            );
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);

        }

    }

    return (

        <section
            style={{
                marginBottom: 15,
                padding: 12,
                background: "#2f2f2f",
                borderRadius: 6
            }}
        >

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>

                <select
                    value={selectedName}
                    onChange={event =>
                        setSelectedName(event.target.value)
                    }
                    disabled={!templates.length}
                >

                    {templates.map(file => (
                        <option key={file.name} value={file.name}>
                            {file.name}
                        </option>
                    ))}

                </select>

                <button
                    onClick={open}
                    disabled={isExecuting || !hasProject || !selectedName}
                >
                    Open PSD
                </button>

                <button
                    onClick={planPlacement}
                    disabled={isExecuting || !hasProject || !document}
                >
                    Plan Placement
                </button>
                <button
                    onClick={addCurrentPsd}
                    disabled={isExecuting || !hasProject || !selectedName}
                >
                    Add Current PSD
                </button>
                <select
                    value={selectedRegisteredId}
                    onChange={event => setSelectedRegisteredId(event.target.value)}
                    disabled={!registeredTemplates.length || isExecuting}
                    aria-label="Registered project templates"
                >
                    {registeredTemplates.map(entry => (
                        <option key={entry.id} value={entry.id}>
                            {entry.name}{entry.validationState === "MISSING" ? " (missing)" : ""}
                        </option>
                    ))}
                </select>
                <button
                    onClick={removeSelectedRegisteredTemplate}
                    disabled={isExecuting || !selectedRegisteredId}
                >
                    Remove Selected Template
                </button>
                <span style={{ fontSize: 12, color: "#b8b8b8" }}>
                    Registered: {registeredTemplates.length}
                </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <button
                    onClick={buildExecutionPlan}
                    disabled={isExecuting || !hasProject || !placementPlan}
                >
                    Build Execution Dry Run
                </button>

                <button
                    onClick={executeFirstReplacementStep}
                    disabled={
                        !hasProject ||
                        isExecuting ||
                        executionPlan?.status !== "READY" ||
                        !replacementRequest?.steps?.length
                    }
                >
                    Execute Replacement
                </button>

                <button
                    onClick={executeReplacementBatchRequest}
                    disabled={isExecuting || !hasProject}
                >
                    {isExecuting ? "Replacing…" : "Replace All"}
                </button>

                <button
                    onClick={executeProjectRequest}
                    disabled={isExecuting || !hasProject}
                >
                    Process Project
                </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 12 }}>
                    <input
                        type="checkbox"
                        checked={autoSaveEnabled}
                        onChange={event => {
                            setAutoSaveEnabled?.(event.target.checked);
                            setAutoSaveResult(null);
                            setPlacementVersion(value => value + 1);
                        }}
                    />
                    Auto Save
                </label>

                <select
                    value={autoSaveMode}
                    onChange={event => {
                        setAutoSaveMode?.(event.target.value);
                        setAutoSaveResult(null);
                        setPlacementVersion(value => value + 1);
                    }}
                >
                    <option value="SAVE_COPY">Save Copy</option>
                    <option value="OVERWRITE_ORIGINAL">Overwrite Original</option>
                </select>

                <label style={{ fontSize: 12 }}>
                    <input
                        type="checkbox"
                        checked={exportEnabled}
                        onChange={event => {
                            setExportEnabled?.(event.target.checked);
                            setExportResult(null);
                            setPlacementVersion(value => value + 1);
                        }}
                    />
                    Export
                </label>

                <select
                    value={exportFormat}
                    onChange={event => {
                        setExportFormat?.(event.target.value);
                        setExportResult(null);
                        setPlacementVersion(value => value + 1);
                    }}
                >
                    <option value="JPEG">JPEG</option>
                    <option value="PSD">PSD</option>
                </select>
                </div>
            </div>

            {false && <>
            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Project Health</div>
                <div>Project: {hasProject ? "READY" : "MISSING"}</div>
                <div>Photos: {healthPhotos.length}</div>
                <div>Template: {healthTemplate ? "READY" : "MISSING"}</div>
                <div>Smart Objects: {healthTemplate?.smartObjects?.length || 0}</div>
                <div>Placement: {placementPlan ? "READY" : "NOT READY"}</div>
                <div>Execution Plan: {executionPlan?.status === "READY" ? "READY" : "NOT READY"}</div>
                <div>Replacement Request: {replacementRequest ? "READY" : "NOT READY"}</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Auto Save: {autoSaveEnabled ? "ON" : "OFF"}</div>
                <div>Mode: {autoSaveMode === "SAVE_COPY" ? "Save Copy" : "Overwrite Original"}</div>
                {autoSaveMode === "OVERWRITE_ORIGINAL" && (
                    <div style={{ color: "#ffcc99" }}>
                        Warning: Overwrite Original is destructive.
                    </div>
                )}
                {autoSaveResult && (
                    <>
                        <div>Auto Save: {autoSaveResult.status}</div>
                        {!!autoSaveResult.outputPath && (
                            <div>Output: {autoSaveResult.outputPath}</div>
                        )}
                        {!!autoSaveResult.warnings?.length && (
                            <div>Warning: {autoSaveResult.warnings.join(" ")}</div>
                        )}
                        {autoSaveResult.error && (
                            <div>Warning: {autoSaveResult.error}</div>
                        )}
                    </>
                )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Export: {exportEnabled ? "ON" : "OFF"}</div>
                <div>Format: {exportFormat}</div>
                {exportResult && (
                    <>
                        <div>Last Export: {exportResult.status}</div>
                        {!!exportResult.outputPath && (
                            <div>Output: {exportResult.outputPath}</div>
                        )}
                        {!!exportResult.warnings?.length && (
                            <div>Warning: {exportResult.warnings.join(" ")}</div>
                        )}
                        {exportResult.error && (
                            <div>Warning: {exportResult.error}</div>
                        )}
                    </>
                )}
            </div>

            {document && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Template Name: {document.name}</div>
                    <div>Width × Height: {document.document.width} × {document.document.height}</div>
                    <div>Resolution: {document.document.resolution}</div>
                    <div>Layer Count: {document.statistics.totalLayers}</div>
                    <div>
                        Smart Objects: {document.statistics.totalSmartObjects}
                    </div>
                    {!!document.smartObjects?.length && (
                        <div>
                            Smart Object Names: {document.smartObjects
                                .map(layer => layer.layerName)
                                .join(", ")}
                        </div>
                    )}
                    <div>
                        Text Layers: {document.statistics.totalTextLayers}
                    </div>
                    {!!document.textLayers?.length && (
                        <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                            {document.textLayers.map(layer => (
                                <li key={layer.layerId}>
                                    {layer.layerName}: {textPreview(layer.textContent)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            )}

            {document?.layerTree && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <LayerTree layers={document.layerTree} />
                </div>

            )}

            {placementPlan && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Assigned Slots: {placementPlan.statistics.assignedSlots}</div>
                    <div>Empty Slots: {placementPlan.statistics.emptySlots}</div>
                    <div>Unassigned Photos: {placementPlan.statistics.unassignedPhotos}</div>
                    <div>Warnings: {placementPlan.warnings.length}</div>
                </div>

            )}

            {placementError && (

                <div style={{ marginTop: 10, fontSize: 12, color: "#ff9999" }}>
                    Placement Plan: {placementError}
                </div>

            )}

            {executionPlan && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Ready Steps: {executionPlan.statistics.readySteps}</div>
                    <div>Warnings: {executionPlan.statistics.warningCount}</div>
                    <div>Status: {executionPlan.status}</div>
                </div>

            )}

            {replacementResult && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Replacement: {replacementResult.status}</div>
                    {!!replacementResult.errors?.length && (
                        <div>{replacementResult.errors.join(" ")}</div>
                    )}
                </div>

            )}

            {executionSummary && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Completed</div>
                    <div>Success: {executionSummary.completedSteps}</div>
                    <div>Failed: {executionSummary.failedSteps}</div>
                </div>

            )}

            {batchProgress && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Batch Progress</div>
                    <div>Status: {batchProgress.status}</div>
                    <div>Current Photo: {batchProgress.currentPhotoName || "—"}</div>
                    <div>Current Slot: {batchProgress.currentSlotName || "—"}</div>
                    <div>Completed: {batchProgress.completedSteps} / {batchProgress.totalSteps}</div>
                    <div>Success: {batchProgress.successCount}</div>
                    <div>Failed: {batchProgress.failedCount}</div>
                </div>

            )}

            {projectExecutionSummary && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>Project Execution</div>
                    <div>Templates</div>
                    <div>Completed : {projectExecutionSummary.completedTemplates}</div>
                    <div>Failed : {projectExecutionSummary.failedTemplates}</div>
                    <div>Status : {projectExecutionSummary.status}</div>
                </div>

            )}
            </>}

        </section>

    );

}
