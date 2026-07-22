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
    projectExecutionSummary
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
            `Completed Templates: ${projectExecutionSummary.completedTemplates}`,
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
    autoSaveResult,
    exportResult,
    projectExecutionSummary,
    placementError
}) {

    const template = document || healthTemplate;
    const selectedPhotos = photos.filter(photo => photo?.selected);
    const slots = template?.smartObjects || [];
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
        `${textValue(photo?.id)} — ${textValue(photo?.name)}`
    ));
    addList(lines, "Smart Object Slots", slots.map(slot =>
        `${textValue(slot?.layerId)} — ${textValue(slot?.layerName)}`
    ));
    addList(lines, "Placement Assignments", (placementPlan?.assignments || []).map(assignment =>
        `photo=${textValue(assignment?.photoId)}, slot=${textValue(assignment?.slotLayerId ?? assignment?.layerId)}, fit=${textValue(assignment?.fitMode)}`
    ));
    addList(lines, "Execution Plan Steps", (executionPlan?.steps || []).map(step =>
        `#${textValue(step?.order)} photo=${textValue(step?.photoId)} (${textValue(step?.photoName)}), slot=${textValue(step?.slotLayerId)} (${textValue(step?.slotName)})`
    ));
    addList(lines, "Replacement Request Steps", (replacementRequest?.steps || []).map(step =>
        `#${textValue(step?.stepNumber)} photo=${textValue(step?.photoId)} (${textValue(step?.photoName)}), slot=${textValue(step?.slotLayerId)} (${textValue(step?.slotName)})`
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
        `Completed Templates: ${textValue(projectExecutionSummary?.completedTemplates, "0")}`,
        `Failed Templates: ${textValue(projectExecutionSummary?.failedTemplates, "0")}`,
        "",
        "Stored Warnings and Errors",
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
    projectExecutionSummary
}) {

    const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
    const [layerListOpen, setLayerListOpen] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState("");
    const sectionStyle = {
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px solid #4a4a4a"
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
        lineHeight: 1.35
    };
    const labelStyle = {
        flex: "0 0 126px",
        color: "#b8b8b8",
        fontSize: 12
    };
    const valueStyle = {
        minWidth: 0,
        overflowWrap: "anywhere",
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
        projectExecutionSummary
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
        autoSaveResult,
        exportResult,
        projectExecutionSummary,
        placementError
    }), "Debug log copied.");

    return (
        <section style={{ marginTop: 20, paddingBottom: 16 }}>
            <h3 style={titleStyle}>Execution Details</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={copySummary}>Copy Summary</button>
                <button type="button" onClick={copyDebugLog}>Copy Debug Log</button>
            </div>
            {copyFeedback && <div style={{ marginTop: 8, fontSize: 12, color: "#b8dca0" }}>{copyFeedback}</div>}

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Project Health</h4>
                <Row label="Project" value={hasProject ? "READY" : "MISSING"} />
                <Row label="Photos" value={healthPhotos.length} />
                <Row label="Template" value={healthTemplate ? "READY" : "MISSING"} />
                <Row label="Smart Objects" value={healthTemplate?.smartObjects?.length || 0} />
                <Row label="Placement" value={placementPlan ? "READY" : "NOT READY"} />
                <Row label="Execution Plan" value={executionPlan?.status === "READY" ? "READY" : "NOT READY"} />
                <Row label="Replacement Request" value={replacementRequest ? "READY" : "NOT READY"} />
            </div>

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Auto Save</h4>
                <Row label="Enabled" value={autoSaveEnabled ? "ON" : "OFF"} />
                <Row label="Mode" value={autoSaveMode === "SAVE_COPY" ? "Save Copy" : "Overwrite Original"} />
                {autoSaveResult && <Row label="Last Result" value={autoSaveResult.status} />}
                {!!autoSaveResult?.outputPath && <Row label="Output" value={autoSaveResult.outputPath} />}
                {!!autoSaveResult?.warnings?.length && <Row label="Warning" value={autoSaveResult.warnings.join(" ")} warning />}
                {autoSaveResult?.error && <Row label="Warning" value={autoSaveResult.error} warning />}
            </div>

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Export</h4>
                <Row label="Enabled" value={exportEnabled ? "ON" : "OFF"} />
                <Row label="Format" value={exportFormat} />
                {exportResult && <Row label="Last Export" value={exportResult.status} />}
                {!!exportResult?.outputPath && <Row label="Output" value={exportResult.outputPath} />}
                {!!exportResult?.warnings?.length && <Row label="Warning" value={exportResult.warnings.join(" ")} warning />}
                {exportResult?.error && <Row label="Warning" value={exportResult.error} warning />}
            </div>

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Template</h4>
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
            </div>

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Placement</h4>
                {placementPlan ? <>
                    <Row label="Assigned Slots" value={placementPlan.statistics.assignedSlots} />
                    <Row label="Empty Slots" value={placementPlan.statistics.emptySlots} />
                    <Row label="Unassigned Photos" value={placementPlan.statistics.unassignedPhotos} />
                    <Row label="Warnings" value={placementPlan.warnings.length} />
                </> : <Row label="Status" value="NOT READY" />}
                {placementError && <Row label="Warning" value={placementError} warning />}
            </div>

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Execution Plan</h4>
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
            </div>

            <div style={sectionStyle}>
                <h4 style={titleStyle}>Batch Progress</h4>
                {batchProgress ? <>
                    <Row label="Status" value={batchProgress.status} />
                    <Row label="Current Photo" value={batchProgress.currentPhotoName || "—"} />
                    <Row label="Current Slot" value={batchProgress.currentSlotName || "—"} />
                    <Row label="Completed" value={`${batchProgress.completedSteps} / ${batchProgress.totalSteps}`} />
                    <Row label="Success" value={batchProgress.successCount} />
                    <Row label="Failed" value={batchProgress.failedCount} />
                </> : <Row label="Status" value="IDLE" />}
                {projectExecutionSummary && <>
                    <Row label="Project Status" value={projectExecutionSummary.status} />
                    <Row label="Templates Complete" value={projectExecutionSummary.completedTemplates} />
                    <Row label="Templates Failed" value={projectExecutionSummary.failedTemplates} />
                </>}
            </div>
        </section>
    );

}

export default function TemplateDocumentPanel({
    loadTemplates,
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
    const [document, setDocument] = useState(null);
    const [, setPlacementVersion] = useState(0);
    const [placementError, setPlacementError] = useState(null);
    const [replacementResult, setReplacementResult] = useState(null);
    const [executionSummary, setExecutionSummary] = useState(null);
    const [batchProgress, setBatchProgress] = useState(() =>
        getCurrentBatchProgress?.() || null
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
                projectExecutionSummary={projectExecutionSummary}
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
        projectExecutionSummary,
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

            }

            catch (_) {

                setTemplates([]);
                setSelectedName("");

            }

        }

        load();

    }, [loadTemplates, hasProject]);

    useEffect(() => {

        if (!hasProject) {
            setDocument(null);
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setProjectExecutionSummary(null);
            setAutoSaveResult(null);
            setExportResult(null);
        }

        else if (!replacementRequest) {
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
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
        setProjectExecutionSummary(null);
        setAutoSaveResult(null);
        setExportResult(null);
        setPlacementVersion(value => value + 1);

    }

    function planPlacement() {

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

        try {

            buildPlacementExecutionPlan?.();
            setPlacementError(null);
            setReplacementResult(null);
            setExecutionSummary(null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
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
            const summary = await executeReplacementBatch(progress => {
                setBatchProgress(progress);
            });

            setExecutionSummary(summary || getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            setPlacementVersion(value => value + 1);

        }

        catch (_) {

            setExecutionSummary(getCurrentExecutionSummary?.() || null);
            setBatchProgress(getCurrentBatchProgress?.() || null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);

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

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center"
                }}
            >

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
                    disabled={!hasProject || !selectedName}
                >
                    Open PSD
                </button>

                <button
                    onClick={planPlacement}
                    disabled={!hasProject || !document}
                >
                    Plan Placement
                </button>

                <button
                    onClick={buildExecutionPlan}
                    disabled={!hasProject || !placementPlan}
                >
                    Build Execution Dry Run
                </button>

                <button
                    onClick={executeFirstReplacementStep}
                    disabled={
                        !hasProject ||
                        executionPlan?.status !== "READY" ||
                        !replacementRequest?.steps?.length
                    }
                >
                    Execute Replacement
                </button>

                <button
                    onClick={executeReplacementBatchRequest}
                    disabled={!hasProject}
                >
                    Replace All
                </button>

                <button
                    onClick={executeProjectRequest}
                    disabled={!hasProject}
                >
                    Process Project
                </button>

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
