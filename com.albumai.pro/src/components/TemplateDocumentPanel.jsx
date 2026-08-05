import React, { useEffect, useMemo, useRef, useState } from "react";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import BatchProgressPanel from "./BatchProgressPanel";
import {
    readCurrentRecoveryState,
    recoveryPanelStateKey
} from "./recoveryPanelState";
import {
    canProcessProject,
    canRevalidateTemplates,
    executionGateFeedback,
    recoveryCompatibilityLabel,
    revalidationFeedback,
    shouldResetTemplatePreflightUi,
    templateRegistryIsBlocked,
    templateRegistryUiSummary,
    templateValidationLabel
} from "./templatePreflightUi";

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
    registeredTemplates = [],
    recoveryState = null
}) {

    const batchResult = [...(projectExecutionSummary?.batchExecution?.templateResults || [])]
        .reverse()
        .find(result => result.status !== "RUNNING") || null;
    const batchPlacement = batchResult
        ? batchResult.placementResult
        : placementPlan;
    const batchExecutionPlan = batchResult
        ? batchResult.executionPlan
        : executionPlan;
    const batchExecutionSummary = batchResult
        ? batchResult.executionSummary
        : executionSummary;
    const batchAutoSave = batchResult
        ? batchResult.autosaveResult
        : autoSaveResult;
    const batchExport = batchResult
        ? batchResult.exportResult
        : exportResult;
    const selectedCount = photos.filter(photo => photo?.selected).length;
    const terminalTemplate = batchResult?.templateContext || null;
    const template = terminalTemplate
        ? { id: terminalTemplate.id, document: { id: terminalTemplate.documentId }, name: terminalTemplate.name, smartObjects: terminalTemplate.smartObjects }
        : (document || healthTemplate);
    const terminalBatch = projectExecutionSummary?.batchExecution || null;
    const isTerminalBatch = terminalBatch?.status &&
        terminalBatch.status !== "RUNNING";
    const summaryProgress = isTerminalBatch
        ? terminalBatch
        : batchProgress;
    const currentTemplateName = isTerminalBatch
        ? "All Templates Completed"
        : projectExecutionSummary?.batchProgress?.currentTemplate?.name ||
            template?.name || "—";
    PhotoBrowserPerformance.trace("SUMMARY_STATE_SOURCE", {
        source: isTerminalBatch ? "terminal-batch" : "live-ui",
        selectedCount
    });
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
        `Name: ${textValue(currentTemplateName)}`,
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
        `Assigned: ${batchPlacement?.statistics?.assignedSlots || 0}`,
        `Empty: ${batchPlacement?.statistics?.emptySlots || 0}`,
        `Unassigned: ${batchPlacement?.statistics?.unassignedPhotos || 0}`,
        "",
        "Execution",
        `Plan Status: ${batchExecutionPlan?.status || "NOT READY"}`,
        `Ready Steps: ${batchExecutionPlan?.statistics?.readySteps || 0}`,
        `Completed: ${summaryProgress?.completedTemplates ?? batchProgress?.completedSteps ?? batchExecutionSummary?.completedSteps ?? 0} / ${summaryProgress?.totalTemplates ?? batchProgress?.totalSteps ?? 0}`,
        `Success: ${summaryProgress?.successfulTemplates ?? batchProgress?.successCount ?? batchExecutionSummary?.completedSteps ?? 0}`,
        `Failed: ${summaryProgress?.failedTemplates ?? batchProgress?.failedCount ?? batchExecutionSummary?.failedSteps ?? 0}`,
        `Lifecycle: ${isTerminalBatch ? terminalBatch.status : (executionLifecycle?.status || "IDLE")}`,
        "",
        "Auto Save",
        `Enabled: ${autoSaveEnabled ? "ON" : "OFF"}`,
        `Mode: ${autoSaveMode === "SAVE_COPY" ? "Save Copy" : "Overwrite Original"}`,
        `Result: ${batchAutoSave?.status || "NOT RUN"}`,
        `Output: ${fileName(batchAutoSave?.outputPath)}`,
        "",
        "Export",
        `Enabled: ${exportEnabled ? "ON" : "OFF"}`,
        `Format: ${exportFormat}`,
        `Result: ${batchExport?.status || "NOT RUN"}`,
        `Output: ${fileName(batchExport?.outputPath)}`
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
            `Failed Templates: ${projectExecutionSummary.failedTemplates}`,
            `Skipped Templates: ${projectExecutionSummary.skippedTemplates || 0}`
        );
    }

    const recovery = recoveryState?.snapshot;
    const recoveryTemplateName = registeredTemplates.find(
        item => item.id === recovery?.currentTemplateId
    )?.name || recovery?.currentTemplateId;
    lines.push(
        "",
        "Recovery",
        `Recovery Available: ${recoveryState?.available ? "Yes" : "No"}`,
        `Recovery State: ${textValue(recoveryState?.classification, "NONE")}`,
        `Previous Batch ID: ${textValue(recovery?.batchId)}`,
        `Previous Batch Status: ${textValue(recovery?.lifecycle)}`,
        `Completed: ${recovery?.completedTemplateIds?.length || 0}`,
        `Successful: ${recovery?.successfulTemplateIds?.length || 0}`,
        `Failed: ${recovery?.failedTemplateIds?.length || 0}`,
        `Pending: ${recovery?.pendingTemplateIds?.length || 0}`,
        `Last Template: ${textValue(recoveryTemplateName)}`,
        `Last Stage: ${textValue(recovery?.lastCompletedStage)}`,
        `Resume/Retry Result: ${textValue(recovery?.runMode)}`
    );

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
    registryError = null,
    recoveryState = null
}) {

    const batchResult = [...(projectExecutionSummary?.batchExecution?.templateResults || [])]
        .reverse()
        .find(result => result.status !== "RUNNING") || null;
    const batchPlacement = batchResult
        ? batchResult.placementResult
        : placementPlan;
    const batchExecutionPlan = batchResult
        ? batchResult.executionPlan
        : executionPlan;
    const batchRequest = batchResult
        ? batchResult.replacementRequest
        : replacementRequest;
    const batchExecutionSummary = batchResult
        ? batchResult.executionSummary
        : executionSummary;
    const batchAutoSave = batchResult
        ? batchResult.autosaveResult
        : autoSaveResult;
    const batchExport = batchResult
        ? batchResult.exportResult
        : exportResult;
    const terminalBatch = projectExecutionSummary?.batchExecution || null;
    const isTerminalBatch = terminalBatch?.status &&
        terminalBatch.status !== "RUNNING";
    const debugProgress = isTerminalBatch ? terminalBatch : batchProgress;
    PhotoBrowserPerformance.trace("DEBUG_STATE_SOURCE", {
        source: isTerminalBatch ? "terminal-batch" : "live-ui"
    });
    if (batchResult) {
        console.info(
            "BATCH_CONTEXT_SHAPE",
            JSON.stringify({
                assignmentCount: batchPlacement?.assignments?.length || 0,
                planStepCount: batchExecutionPlan?.steps?.length || 0,
                requestStepCount: batchRequest?.steps?.length || 0,
                replacementCompleted:
                    batchExecutionSummary?.status === "COMPLETED"
            })
        );
    }
    const terminalTemplate = batchResult?.templateContext || null;
    const template = terminalTemplate
        ? { id: terminalTemplate.id, document: { id: terminalTemplate.documentId }, name: terminalTemplate.name, smartObjects: terminalTemplate.smartObjects }
        : (document || healthTemplate);
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
    addList(lines, "Placement Assignments", (batchPlacement?.assignments || []).map(assignment =>
        `photo=${photoName(assignment?.photoId, assignment?.photoName)}, slot=${textValue(assignment?.slotLayerId ?? assignment?.layerId)}, fit=${textValue(assignment?.fitMode)}`
    ));
    addList(lines, "Execution Plan Steps", (batchExecutionPlan?.steps || []).map(step =>
        `#${textValue(step?.order)} photo=${photoName(step?.photoId, step?.photoName)}, slot=${textValue(step?.slotLayerId)} (${textValue(step?.slotName)})`
    ));
    addList(lines, "Replacement Request Steps", (batchRequest?.steps || []).map(step =>
        `#${textValue(step?.stepNumber)} photo=${photoName(step?.photoId, step?.photoName)}, slot=${textValue(step?.slotLayerId)} (${textValue(step?.slotName)})`
    ));

    lines.push(
        "Batch Progress",
        `Status: ${textValue(debugProgress?.status)}`,
        `Completed: ${textValue(debugProgress?.completedTemplates ?? debugProgress?.completedSteps, "0")} / ${textValue(debugProgress?.totalTemplates ?? debugProgress?.totalSteps, "0")}`,
        `Success: ${textValue(debugProgress?.successfulTemplates ?? debugProgress?.successCount, "0")}`,
        `Failed: ${textValue(debugProgress?.failedTemplates ?? debugProgress?.failedCount, "0")}`,
        "",
        "Execution Summary",
        `Status: ${textValue(batchExecutionSummary?.status)}`,
        `Completed: ${textValue(batchExecutionSummary?.completedSteps, "0")}`,
        `Failed: ${textValue(batchExecutionSummary?.failedSteps, "0")}`,
        `Lifecycle: ${textValue(executionLifecycle?.status, "IDLE")}`,
        `Lifecycle Error: ${textValue(executionLifecycle?.error, "None")}`,
        "",
        "Auto Save Result",
        `Status: ${textValue(batchAutoSave?.status)}`,
        `Output: ${fileName(batchAutoSave?.outputPath)}`,
        `Warnings: ${(batchAutoSave?.warnings || []).join(" | ") || "None"}`,
        `Error: ${textValue(batchAutoSave?.error, "None")}`,
        "",
        "Export Result",
        `Status: ${textValue(batchExport?.status)}`,
        `Output: ${fileName(batchExport?.outputPath)}`,
        `Warnings: ${(batchExport?.warnings || []).join(" | ") || "None"}`,
        `Error: ${textValue(batchExport?.error, "None")}`,
        "",
        "Project Execution Summary",
        `Status: ${textValue(projectExecutionSummary?.status)}`,
        `Registered Templates: ${registeredTemplates.length}`,
        `Completed Templates: ${textValue(projectExecutionSummary?.completedTemplates, "0")}`,
        `Successful Templates: ${textValue(projectExecutionSummary?.successfulTemplates, "0")}`,
        `Failed Templates: ${textValue(projectExecutionSummary?.failedTemplates, "0")}`,
        `Skipped Templates: ${textValue(projectExecutionSummary?.skippedTemplates, "0")}`,
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
            `${textValue(result.templateId)} — ${textValue(result.templateName)} [document=${textValue(result.documentContext?.documentId)}]: ${textValue(result.status)}${result.photoAllocation ? ` [${result.photoAllocation.assignedCount ? `photos ${result.photoAllocation.startCursor + 1}-${result.photoAllocation.endCursor}` : "photos: none"}, assigned=${result.photoAllocation.assignedCount}, remaining=${result.photoAllocation.remainingCount}]` : ""}${result.error ? ` (${result.error})` : ""}`
        ),
        "",
        "Stored Warnings and Errors",
        `Registry: ${textValue(registryError || projectExecutionSummary?.registryValidationError, "None")}`,
        `Placement: ${textValue(placementError, "None")}`,
        `Placement Warnings: ${(batchPlacement?.warnings || []).map(warning => warning?.message || String(warning)).join(" | ") || "None"}`,
        `Execution Warnings: ${(batchExecutionPlan?.warnings || []).map(warning => warning?.message || String(warning)).join(" | ") || "None"}`
    );

    const recovery = recoveryState?.snapshot;
    const recoveryTemplateName = registeredTemplates.find(
        item => item.id === recovery?.currentTemplateId
    )?.name || recovery?.currentTemplateId;
    lines.push(
        "",
        "Batch Recovery",
        `Available: ${recoveryState?.available ? "Yes" : "No"}`,
        `Classification: ${textValue(recoveryState?.classification, "NONE")}`,
        `Batch ID: ${textValue(recovery?.batchId)}`,
        `Status: ${textValue(recovery?.lifecycle)}`,
        `Run Mode: ${textValue(recovery?.runMode)}`,
        `Completed/Success/Failed/Skipped/Pending: ${recovery?.completedTemplateIds?.length || 0}/${recovery?.successfulTemplateIds?.length || 0}/${recovery?.failedTemplateIds?.length || 0}/${(recovery?.templateOutcomes || []).filter(item => item.status === "SKIPPED_NO_PHOTOS").length}/${recovery?.pendingTemplateIds?.length || 0}`,
        `Last Template: ${textValue(recoveryTemplateName)}`,
        `Last Stage: ${textValue(recovery?.lastCompletedStage)}`,
        `Warnings: ${(recovery?.warnings || []).join(" | ") || "None"}`,
        `Fatal Error: ${textValue(recovery?.fatalError, "None")}`,
        "Recovery Template Outcomes",
        ...(recovery?.templateOutcomes || []).map(item =>
            `${textValue(item.templateId)} — ${textValue(item.templateName)}: ${textValue(item.status)}${item.photoAllocation ? ` [${item.photoAllocation.assignedCount ? `photos ${item.photoAllocation.startCursor + 1}-${item.photoAllocation.endCursor}` : "photos: none"}, assigned=${item.photoAllocation.assignedCount}, remaining=${item.photoAllocation.remainingCount}]` : ""}${item.error ? ` (${item.error})` : ""}`
        )
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
    registryError = null,
    recoveryState = null,
    onResumeBatch,
    onRetryFailed,
    onClearRecovery,
    recoveryBusy = false,
    recoveryRefreshVersion = 0
}) {

    const recoverySnapshot = recoveryState?.snapshot || null;
    const [clearRecoveryBusy, setClearRecoveryBusy] = useState(false);
    const clearRecoveryInFlight = useRef(false);
    const effectiveRecoveryBusy = recoveryBusy || clearRecoveryBusy;
    const canClearRecovery = useMemo(
        () => Boolean(recoverySnapshot) && !effectiveRecoveryBusy,
        [recoverySnapshot, effectiveRecoveryBusy]
    );
    const lastRecoveryTemplate = registeredTemplates.find(
        item => item.id === recoverySnapshot?.currentTemplateId
    )?.name || recoverySnapshot?.currentTemplateId || "—";
    const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
    const [layerListOpen, setLayerListOpen] = useState(false);
    const [detailSections, setDetailSections] = useState({
        autoSave: false,
        export: false,
        template: false,
        placement: false,
        executionPlan: true,
        batchProgress: true,
        recovery: true
    });
    const [copyFeedback, setCopyFeedback] = useState("");
    const [clearRecoveryFeedback, setClearRecoveryFeedback] = useState("");
    const clearFeedbackThroughVersion = useRef(-1);
    const clearFeedbackProjectId = useRef(projectId);

    useEffect(() => {
        if (clearFeedbackProjectId.current !== projectId) {
            clearFeedbackProjectId.current = projectId;
            clearFeedbackThroughVersion.current = -1;
            setClearRecoveryFeedback("");
            return;
        }
        if (
            clearRecoveryFeedback &&
            recoveryRefreshVersion > clearFeedbackThroughVersion.current
        ) {
            setClearRecoveryFeedback("");
        }
    }, [projectId, recoveryRefreshVersion]);
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
        registeredTemplates,
        recoveryState
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
        registryError,
        recoveryState
    }), "Debug log copied.");
    const runClearRecovery = async () => {
        if (effectiveRecoveryBusy || clearRecoveryInFlight.current) return null;

        clearRecoveryInFlight.current = true;
        setClearRecoveryBusy(true);
        setClearRecoveryFeedback("");

        try {
            if (typeof onClearRecovery !== "function") {
                throw new Error("Clear Recovery State is unavailable.");
            }
            const result = await onClearRecovery();
            if (!result?.status) {
                throw new Error("Clear Recovery State returned no result.");
            }
            setClearRecoveryFeedback(
                result.status === "CLEARED"
                    ? "CLEARED — Recovery state cleared."
                    : "NOT_PRESENT — No recovery state was present."
            );
            clearFeedbackThroughVersion.current = recoveryRefreshVersion + 1;
            return result;
        } catch (error) {
            setClearRecoveryFeedback(
                `FAILED — ${error?.message || "Recovery state could not be cleared."}`
            );
            clearFeedbackThroughVersion.current = recoveryRefreshVersion + 1;
            return {
                status: "FAILED",
                error: error?.message || "Recovery state could not be cleared."
            };
        } finally {
            clearRecoveryInFlight.current = false;
            setClearRecoveryBusy(false);
        }
    };
    const handleClearRecoveryPointerDown = async () => {
        if (effectiveRecoveryBusy) return;
        await runClearRecovery();
    };
    const handleClearRecoveryKeyDown = async event => {
        if (event?.repeat) return;
        if (event?.key !== "Enter" && event?.key !== " " && event?.key !== "Spacebar") return;
        await runClearRecovery();
    };

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

            <DetailSection id="recovery" title="Recovery">
                {(() => {
                    const classification = recoveryState?.classification || "NONE";
                    const lifecycle = recoverySnapshot?.lifecycle || "NONE";
                    const runMode = recoverySnapshot?.runMode || "PROCESS_PROJECT";
                    const pendingCount = recoverySnapshot?.pendingTemplateIds?.length || 0;
                    const failedCount = recoverySnapshot?.failedTemplateIds?.length || 0;
                    const completedCount = recoverySnapshot?.completedTemplateIds?.length || 0;
                    const successfulCount = recoverySnapshot?.successfulTemplateIds?.length || 0;
                    const recoveryAvailable = Boolean(recoveryState?.available);
                    const invalidRecovery = ["STALE", "INCOMPATIBLE"].includes(classification);
                    const retryRecovery = runMode === "RETRY_FAILED";

                    const showResume = recoveryAvailable &&
                        !invalidRecovery &&
                        !retryRecovery &&
                        pendingCount > 0 &&
                        ["RUNNING", "INTERRUPTED", "CANCELLED"].includes(lifecycle);

                    const showRetry = recoveryAvailable &&
                        !invalidRecovery &&
                        failedCount > 0 &&
                        (
                            lifecycle === "COMPLETED_WITH_ERRORS" ||
                            (lifecycle === "CANCELLED" && retryRecovery)
                        );

                    let recoveryMessage = "No recovery action is required.";

                    if (recoveryBusy) {
                        recoveryMessage = retryRecovery
                            ? "Retrying failed templates…"
                            : "Recovery in progress…";
                    } else if (invalidRecovery) {
                        recoveryMessage = classification === "STALE"
                            ? "Recovery state no longer matches this project or template registry."
                            : "Recovery state was created by a newer unsupported version.";
                    } else if (showRetry) {
                        recoveryMessage = `${failedCount} failed template${failedCount === 1 ? "" : "s"} ready to retry.`;
                    } else if (showResume) {
                        recoveryMessage = `Batch stopped with ${completedCount} completed and ${pendingCount} remaining.`;
                    } else if (lifecycle === "COMPLETED" && failedCount === 0 && pendingCount === 0) {
                        recoveryMessage = "Batch completed successfully.";
                    } else if (lifecycle === "COMPLETED_WITH_ERRORS") {
                        recoveryMessage = `Batch completed with ${failedCount} failed template${failedCount === 1 ? "" : "s"}.`;
                    }

                    const failedOutcomes = (recoverySnapshot?.templateOutcomes || [])
                        .filter(item => item.status === "FAILED");

                    return <>
                        <Row label="Recovery Available" value={recoveryAvailable ? "Yes" : "No"} />
                        <Row label="Recovery State" value={classification} warning={invalidRecovery} />
                        <Row label="Previous Status" value={lifecycle} />
                        <Row label="Run Mode" value={runMode} />
                        <Row label="Message" value={recoveryMessage} warning={invalidRecovery || failedCount > 0} />
                        <Row label="Completed" value={completedCount} />
                        <Row label="Successful" value={successfulCount} />
                        <Row label="Failed" value={failedCount} />
                        <Row label="Pending" value={pendingCount} />
                        <Row label="Last Template" value={lastRecoveryTemplate} />
                        <Row label="Last Stage" value={recoverySnapshot?.lastCompletedStage || "—"} />

                        {failedOutcomes.map(item => (
                            <Row
                                key={`failed-recovery-${item.templateId}`}
                                label={`Failed: ${item.templateName || item.templateId}`}
                                value={item.error || "Template execution failed."}
                                warning
                            />
                        ))}

                        {clearRecoveryFeedback && (
                            <Row
                                label="Clear Result"
                                value={clearRecoveryFeedback}
                                warning={clearRecoveryFeedback.startsWith("FAILED")}
                            />
                        )}

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                            {showResume && (
                                <button
                                    type="button"
                                    onClick={onResumeBatch}
                                    disabled={recoveryBusy}
                                >
                                    {recoveryBusy ? "Resuming…" : "Resume Batch"}
                                </button>
                            )}

                            {showRetry && (
                                <button
                                    type="button"
                                    onClick={onRetryFailed}
                                    disabled={recoveryBusy}
                                >
                                    {recoveryBusy ? "Retrying…" : "Retry Failed Templates"}
                                </button>
                            )}

                            <button
                                key="clear-recovery-state"
                                type="button"
                                className="clear-recovery-button"
                                onPointerDown={handleClearRecoveryPointerDown}
                                onKeyDown={handleClearRecoveryKeyDown}
                                disabled={!canClearRecovery}
                            >
                                Clear Recovery State
                            </button>
                        </div>
                    </>;
                })()}
            </DetailSection>
        </section>
    );

}

export default function TemplateDocumentPanel({
    loadTemplates,
    getRegisteredProjectTemplates,
    revalidateProjectTemplates,
    getTemplateRegistryPreflightState,
    getTemplateRegistryRecoveryCompatibility,
    addCurrentPsdToProject,
    removeRegisteredProjectTemplate,
    moveRegisteredProjectTemplate,
    requestBatchCancellation,
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
    resumeProjectBatch,
    retryFailedTemplates,
    clearRecoveryState,
    getBatchRecoveryState,
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
    const [draggedTemplateId, setDraggedTemplateId] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [registryMutating, setRegistryMutating] = useState(false);
    const draggedTemplateIdRef = useRef(null);
    const registeredTemplatesRef = useRef([]);
    const dragStateRef = useRef(null);
    const templateRowRefs = useRef(new Map());
    const templateListRef = useRef(null);
    const mountedRef = useRef(true);
    const renderedDragHandlesRef = useRef(new Set());
    const [registryError, setRegistryError] = useState(null);
    const [registryPreflightState, setRegistryPreflightState] = useState(() =>
        getTemplateRegistryPreflightState?.() || null
    );
    const [revalidateBusy, setRevalidateBusy] = useState(false);
    const [revalidationMessage, setRevalidationMessage] = useState("");
    const [templatesWorkspaceAvailable, setTemplatesWorkspaceAvailable] = useState(false);
    const revalidationRequestRef = useRef(0);
    const revalidationProjectIdRef = useRef(projectId);
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
    const [recoveryVersion, setRecoveryVersion] = useState(0);
    const currentRecoveryState = readCurrentRecoveryState(
        getBatchRecoveryState
    );
    const [
        recoveryAvailable,
        recoveryClassification,
        recoverySnapshot
    ] = recoveryPanelStateKey(currentRecoveryState);
    // The controller returns a fresh wrapper object for each read. Keep the
    // panel state identity stable for effects, but replace it immediately when
    // a folder change clears the authoritative snapshot.
    const recoveryState = useMemo(
        () => currentRecoveryState,
        [
            recoveryVersion,
            projectId,
            hasProject,
            recoveryAvailable,
            recoveryClassification,
            recoverySnapshot
        ]
    );
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
    const activeBatchLifecycle = ["RUNNING", "CANCEL_REQUESTED", "CANCELLING"].includes(
        projectExecutionSummary?.batchProgress?.lifecycle
    );
    const isExecuting = executionLifecycle?.status === "RUNNING" || activeBatchLifecycle;
    const registryLocked = isExecuting || registryMutating || revalidateBusy;
    const registrySummary = templateRegistryUiSummary(
        registeredTemplates,
        registryPreflightState
    );
    const registryBlocked = templateRegistryIsBlocked(
        registeredTemplates,
        registryPreflightState
    );
    const recoveryCompatibility = recoverySnapshot
        ? getTemplateRegistryRecoveryCompatibility?.() || ""
        : "";

    useEffect(() => {
        registeredTemplatesRef.current = registeredTemplates;
    }, [registeredTemplates]);

    useEffect(() => {
        console.info("ALB-032.3-mouse-drag-v1");
        console.info("ALB-036-recovery-ui-hardening-v1");
        console.info("ALB-037.4-restored-template-status-refresh-v1");
    }, []);

    useEffect(() => {
        if (shouldResetTemplatePreflightUi({
            hasProject,
            projectId,
            previousProjectId: revalidationProjectIdRef.current
        })) {
            revalidationRequestRef.current += 1;
            revalidationProjectIdRef.current = projectId;
            setRevalidateBusy(false);
            setRevalidationMessage("");
            setTemplatesWorkspaceAvailable(false);
        }
        refreshRegistryPreflightState();
    }, [hasProject, projectId]);

    function refreshRegisteredTemplates() {
        const entries = getRegisteredProjectTemplates?.() || [];
        setRegisteredTemplates(entries);
        setSelectedRegisteredId(current => entries.some(entry => entry.id === current)
            ? current
            : (entries[0]?.id || ""));
    }

    function refreshRegistryPreflightState() {
        const next = getTemplateRegistryPreflightState?.() || null;
        setRegistryPreflightState(current => current === next ? current : next);
    }

    function refreshRecoveryState() {
        setRecoveryVersion(value => value + 1);
    }

    useEffect(() => {

        PhotoBrowserPerformance.recordRenderUpdate(
            "TemplateDocumentPanel",
            "executionDetailsEffect"
        );
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
                recoveryState={recoveryState}
                recoveryBusy={isExecuting}
                onResumeBatch={() => executeRecoveryAction(resumeProjectBatch)}
                onRetryFailed={() => executeRecoveryAction(retryFailedTemplates)}
                onClearRecovery={clearRecovery}
                recoveryRefreshVersion={recoveryVersion}
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
        recoveryVersion,
        recoveryState,
        isExecuting,
        onExecutionDetailsChange
    ]);

    useEffect(() => {

        let active = true;
        PhotoBrowserPerformance.recordRenderUpdate(
            "TemplateDocumentPanel",
            "loadEffectEntry",
            { hasProject, projectId }
        );

        async function load() {

            if (!hasProject) {
                setTemplatesWorkspaceAvailable(false);
                setTemplates(current =>
                    current.length ? [] : current
                );
                setSelectedName(current =>
                    current ? "" : current
                );
                return;
            }

            try {

                const files = await loadTemplates();

                if (!active) return;

                PhotoBrowserPerformance.recordRenderUpdate(
                    "TemplateDocumentPanel",
                    "loadEffectStateUpdate",
                    { templates: files.length }
                );
                setTemplates(files);
                setTemplatesWorkspaceAvailable(true);
                setSelectedName(files[0]?.name || "");
                refreshRegisteredTemplates();
                refreshRegistryPreflightState();
                refreshRecoveryState();

            }

            catch (_) {

                if (!active) return;

                setTemplates([]);
                setTemplatesWorkspaceAvailable(false);
                setSelectedName("");
                refreshRegisteredTemplates();
                refreshRegistryPreflightState();
                setRevalidateBusy(false);
                setRevalidationMessage("");

            }

        }

        load();

        return () => {
            PhotoBrowserPerformance.recordRenderUpdate(
                "TemplateDocumentPanel",
                "loadEffectCleanup",
                { projectId }
            );
            active = false;
        };

    }, [loadTemplates, hasProject, projectId]);

    async function revalidateTemplatesRequest() {
        if (!canRevalidateTemplates({
            hasProject,
            isExecuting,
            registryMutating,
            revalidateBusy,
            workspaceAvailable: templatesWorkspaceAvailable
        })) return;

        const requestId = ++revalidationRequestRef.current;
        const requestProjectId = projectId;
        setRevalidateBusy(true);
        setRevalidationMessage("");

        try {
            const result = await revalidateProjectTemplates?.({
                reason: "USER_REVALIDATE"
            });
            if (!mountedRef.current || requestId !== revalidationRequestRef.current ||
                requestProjectId !== revalidationProjectIdRef.current) return;
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            setRevalidationMessage(revalidationFeedback(result));
        } catch (_) {
            if (!mountedRef.current || requestId !== revalidationRequestRef.current ||
                requestProjectId !== revalidationProjectIdRef.current) return;
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            setRevalidationMessage(
                "Template validation could not be completed. Check project access and try again."
            );
        } finally {
            if (mountedRef.current && requestId === revalidationRequestRef.current &&
                requestProjectId === revalidationProjectIdRef.current) {
                setRevalidateBusy(false);
            }
        }
    }

    async function addCurrentPsd() {
        const file = templates.find(item => item.name === selectedName);
        if (!file) return;
        try {
            await addCurrentPsdToProject?.(file);
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            refreshRecoveryState();
            setRevalidationMessage("");
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        }
    }

    async function removeSelectedRegisteredTemplate(id = selectedRegisteredId) {
        if (!id || registryLocked) return;
        try {
            setRegistryMutating(true);
            await removeRegisteredProjectTemplate?.(id);
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            refreshRecoveryState();
            setRevalidationMessage("");
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        } finally {
            setRegistryMutating(false);
        }
    }

    async function moveRegisteredTemplate(id, targetIndex, method) {
        if (registryLocked) return;
        try {
            setRegistryMutating(true);
            const moved = await moveRegisteredProjectTemplate?.(id, targetIndex, method);
            if (!moved) return;
            refreshRegisteredTemplates();
            refreshRegistryPreflightState();
            refreshRecoveryState();
            setRevalidationMessage("");
            setRegistryError(null);
        } catch (error) {
            setRegistryError(error.message);
        } finally {
            setRegistryMutating(false);
        }
    }

    function reorderDiagnostic(event, details) {
        console.info(event, JSON.stringify({
            method: "drag",
            batchRunning: isExecuting,
            mutationRunning: registryMutating,
            ...details
        }));
    }

    function detachMouseDragListeners(drag) {
        const target = drag?.listNode;
        const listeners = drag?.listeners;
        if (!target || !listeners || typeof target.removeEventListener !== "function") return;
        target.removeEventListener("mousemove", listeners.move);
        target.removeEventListener("mouseup", listeners.up);
        target.removeEventListener("mouseleave", listeners.leave);
    }

    function clearTemplateDrag({ cancelled = false, reason = null, updateState = mountedRef.current } = {}) {
        const drag = dragStateRef.current;
        if (cancelled && drag) {
            const entries = registeredTemplatesRef.current;
            const entry = entries[drag.sourceIndex];
            reorderDiagnostic("TEMPLATE_REORDER_CANCELLED", {
                templateId: drag.templateId,
                templateName: entry?.name || "",
                sourceIndex: drag.sourceIndex,
                targetIndex: drag.targetIndex,
                reason
            });
        }
        detachMouseDragListeners(drag);
        dragStateRef.current = null;
        draggedTemplateIdRef.current = null;
        if (updateState) {
            setDraggedTemplateId(null);
            setDropTarget(null);
        }
    }

    function cancelTemplateDrag(templateId, reason = "cancelled") {
        if (dragStateRef.current?.templateId === templateId) {
            clearTemplateDrag({ cancelled: true, reason });
        } else if (templateId) {
            console.info("TEMPLATE_REORDER_CANCELLED", JSON.stringify({
                templateId,
                templateName: registeredTemplates.find(entry => entry.id === templateId)?.name || "",
                sourceIndex: registeredTemplates.findIndex(entry => entry.id === templateId),
                targetIndex: null,
                method: "drag",
                batchRunning: isExecuting,
                mutationRunning: registryMutating,
                reason
            }));
        }
    }

    function targetFromMouse(clientY) {
        const drag = dragStateRef.current;
        const entries = registeredTemplatesRef.current;
        if (!drag || !entries.length) return null;
        let insertIndex = entries.length;
        let position = "after";
        let targetId = entries[entries.length - 1]?.id || null;
        for (let index = 0; index < entries.length; index += 1) {
            const entry = entries[index];
            const row = drag.rowNodes.get(entry.id);
            if (!row) continue;
            const bounds = row.getBoundingClientRect();
            if (clientY < bounds.top + bounds.height / 2) {
                insertIndex = index;
                position = "before";
                targetId = entry.id;
                break;
            }
        }
        let targetIndex = insertIndex;
        if (drag.sourceIndex < targetIndex) targetIndex -= 1;
        targetIndex = Math.max(0, Math.min(entries.length - 1, targetIndex));
        return { id: targetId, position, targetIndex };
    }

    function updateMouseDragTarget(clientY) {
        const drag = dragStateRef.current;
        const target = targetFromMouse(clientY);
        if (!drag || !target) return;
        if (drag.targetIndex !== target.targetIndex) {
            drag.targetIndex = target.targetIndex;
            reorderDiagnostic("TEMPLATE_REORDER_DRAG_TARGET", {
                templateId: drag.templateId,
                templateName: registeredTemplatesRef.current[drag.sourceIndex]?.name || "",
                sourceIndex: drag.sourceIndex,
                targetIndex: target.targetIndex
            });
        }
        setDropTarget(target);
    }

    function finishMouseDrag(event) {
        const drag = dragStateRef.current;
        if (!drag) return;
        const bounds = drag.listNode?.getBoundingClientRect?.();
        const releasedOutsideList = bounds && (
            event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom
        );
        if (releasedOutsideList) {
            clearTemplateDrag({ cancelled: true, reason: "pointer-released-outside-list" });
            return;
        }
        const { templateId, sourceIndex, targetIndex } = drag;
        clearTemplateDrag();
        if (targetIndex !== sourceIndex) {
            moveRegisteredTemplate(templateId, targetIndex, "drag");
        }
    }

    function moveMouseDrag(event) {
        const drag = dragStateRef.current;
        if (!drag) return;
        const distance = Math.max(
            Math.abs(event.clientX - drag.startClientX),
            Math.abs(event.clientY - drag.startClientY)
        );
        if (!drag.thresholdPassed) {
            if (distance < 4) return;
            drag.thresholdPassed = true;
            reorderDiagnostic("TEMPLATE_DRAG_THRESHOLD_PASSED", {
                templateId: drag.templateId,
                sourceIndex: drag.sourceIndex,
                targetIndex: drag.targetIndex,
                clientX: event.clientX,
                clientY: event.clientY,
                thresholdPassed: true
            });
            reorderDiagnostic("TEMPLATE_REORDER_DRAG_START", {
                templateId: drag.templateId,
                templateName: drag.templateName,
                sourceIndex: drag.sourceIndex,
                targetIndex: drag.targetIndex
            });
            setDraggedTemplateId(drag.templateId);
        }
        updateMouseDragTarget(event.clientY);
    }

    function beginTemplateMouseDrag(event, entry, sourceIndex) {
        reorderDiagnostic("TEMPLATE_DRAG_HANDLE_MOUSEDOWN", {
            templateId: entry.id,
            sourceIndex,
            button: event.button,
            hasListNode: Boolean(templateListRef.current),
            rowCount: templateRowRefs.current.size,
            clientX: event.clientX,
            clientY: event.clientY,
            thresholdPassed: false,
            targetIndex: sourceIndex
        });
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (registryLocked) {
            reorderDiagnostic("TEMPLATE_REORDER_REJECTED", {
                templateId: entry.id,
                templateName: entry.name,
                sourceIndex,
                targetIndex: sourceIndex,
                reason: isExecuting ? "batch-running" : "registry-mutation-running"
            });
            return;
        }
        const listNode = templateListRef.current;
        if (!listNode || typeof listNode.addEventListener !== "function") {
            reorderDiagnostic("TEMPLATE_REORDER_REJECTED", {
                templateId: entry.id,
                sourceIndex,
                targetIndex: sourceIndex,
                reason: "template-list-unavailable"
            });
            return;
        }
        dragStateRef.current = {
            templateId: entry.id,
            templateName: entry.name,
            sourceIndex,
            targetIndex: sourceIndex,
            listNode,
            rowNodes: new Map(templateRowRefs.current),
            startClientX: event.clientX,
            startClientY: event.clientY,
            thresholdPassed: false,
            listeners: null
        };
        draggedTemplateIdRef.current = entry.id;
        const listeners = {
            move: moveMouseDrag,
            up: finishMouseDrag,
            leave: () => clearTemplateDrag({ cancelled: true, reason: "mouse-left-list" })
        };
        dragStateRef.current.listeners = listeners;
        listNode.addEventListener("mousemove", listeners.move);
        listNode.addEventListener("mouseup", listeners.up);
        listNode.addEventListener("mouseleave", listeners.leave);
        reorderDiagnostic("TEMPLATE_DRAG_LISTENER_ATTACHED", {
            templateId: entry.id,
            sourceIndex,
            button: event.button,
            hasListNode: true,
            rowCount: dragStateRef.current.rowNodes.size,
            clientX: event.clientX,
            clientY: event.clientY,
            thresholdPassed: false,
            targetIndex: sourceIndex
        });
    }

    useEffect(() => () => {
        mountedRef.current = false;
        revalidationRequestRef.current += 1;
        if (dragStateRef.current) {
            clearTemplateDrag({ cancelled: true, reason: "component-unmount", updateState: false });
        }
    }, []);

    useEffect(() => {
        if (registryLocked && dragStateRef.current) {
            clearTemplateDrag({ cancelled: true, reason: isExecuting ? "batch-running" : "registry-mutation-running" });
        }
    }, [registryLocked, isExecuting]);

    useEffect(() => {

        if (!hasProject) {
            setDocument(null);
            setRegistryError(null);
            setRegistryPreflightState(null);
            setRevalidationMessage("");
            setRevalidateBusy(false);
            setTemplatesWorkspaceAvailable(false);
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

            setRegistryError(null);

            const summary = await executeProject(nextSummary => {
                setProjectExecutionSummary(nextSummary);
                refreshRecoveryState();
            });

            const gateFeedback = executionGateFeedback(summary);
            if (gateFeedback) {
                setRegistryError(gateFeedback);
                refreshRegisteredTemplates();
                refreshRegistryPreflightState();
                setProjectExecutionSummary(
                    getCurrentProjectExecutionSummary?.() || null
                );
                return;
            }

            setProjectExecutionSummary(
                summary || getCurrentProjectExecutionSummary?.() || null
            );
            setRegistryError(null);
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);
            refreshRecoveryState();

        }

        catch (error) {

            if (error?.code === "NO_SELECTED_PHOTOS") {
                setRegistryError("Select at least one photo before processing.");
            }

            setProjectExecutionSummary(
                getCurrentProjectExecutionSummary?.() || null
            );
            setAutoSaveResult(getCurrentAutoSaveResult?.() || null);
            setExportResult(getCurrentExportResult?.() || null);

        }

    }

    async function executeRecoveryAction(action) {
        if (typeof action !== "function" || isExecuting) return;
        try {
            const summary = await action(nextSummary => {
                setProjectExecutionSummary(nextSummary);
                refreshRecoveryState();
            });
            const finalSummary = summary || getCurrentProjectExecutionSummary?.() || null;
            setProjectExecutionSummary(finalSummary);
            // Resolution updates the authoritative registry during execution;
            // refresh the copied row data only after a successful retry ends.
            if (action === retryFailedTemplates &&
                finalSummary?.failedTemplates === 0 &&
                finalSummary?.batchProgress?.lifecycle === "COMPLETED") {
                refreshRegisteredTemplates();
            }
        } finally {
            refreshRecoveryState();
        }
    }

    async function clearRecovery() {
        if (isExecuting) {
            const error = new Error("A project batch is already running.");
            throw error;
        }
        if (typeof clearRecoveryState !== "function") {
            const error = new Error("Clear Recovery State is unavailable.");
            throw error;
        }

        try {
            const result = await clearRecoveryState();
            if (result?.status === "FAILED") {
                throw new Error(result.error || "Recovery state could not be cleared.");
            }
            if (!result?.status) {
                throw new Error("Clear Recovery State returned no result.");
            }
            refreshRecoveryState();
            return result;
        } catch (error) {
            refreshRecoveryState();
            throw error;
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
                    disabled={registryLocked || !hasProject || !selectedName}
                >
                    Add Current PSD
                </button>
                <span style={{ fontSize: 12, color: "#b8b8b8" }}>
                    Registered: {registeredTemplates.length}
                </span>
                <button
                    onClick={revalidateTemplatesRequest}
                    disabled={!canRevalidateTemplates({
                        hasProject,
                        isExecuting,
                        registryMutating,
                        revalidateBusy,
                        workspaceAvailable: templatesWorkspaceAvailable
                    })}
                >
                    {revalidateBusy ? "Revalidating…" : "Revalidate Templates"}
                </button>
                </div>

                <div style={{ fontSize: 12, color: registryBlocked ? "#ffcc88" : "#9ee6a5" }}>
                    Ready: {registrySummary.ready} · Blocking: {registrySummary.blocking}
                    {registryBlocked && " — Template registry needs attention before processing."}
                </div>
                {revalidationMessage && (
                    <div style={{ fontSize: 12, color: revalidationMessage.includes("could not") ? "#ff9999" : "#b8dca0" }}>
                        {revalidationMessage}
                    </div>
                )}
                {recoverySnapshot && recoveryCompatibility && (
                    <div style={{ fontSize: 12, color: recoveryCompatibility === "COMPATIBLE" ? "#9ee6a5" : "#ffcc88" }}>
                        Recovery compatibility: {recoveryCompatibilityLabel(recoveryCompatibility)}
                    </div>
                )}

                <div
                    ref={templateListRef}
                    aria-label="Registered project templates in batch execution order"
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    {registeredTemplates.map((entry, index) => {
                        const isSelected = entry.id === selectedRegisteredId;
                        const isDropBefore = dropTarget?.id === entry.id && dropTarget?.position === "before";
                        const isDropAfter = dropTarget?.id === entry.id && dropTarget?.position === "after";
                        const status = templateValidationLabel(entry.validationState);
                        const statusBlocked = entry.validationState !== "READY";
                        return (
                            <div key={entry.id}>
                                {isDropBefore && <div className="drop-before" style={{ height: 2, background: "#4da3ff", marginBottom: 3 }} />}
                                <div
                                    ref={node => {
                                        if (node) templateRowRefs.current.set(entry.id, node);
                                        else templateRowRefs.current.delete(entry.id);
                                    }}
                                    role="button"
                                    className={`template-row${draggedTemplateId === entry.id ? " dragging" : ""}${isDropBefore ? " drop-before" : ""}${isDropAfter ? " drop-after" : ""}`}
                                    tabIndex={0}
                                    title={`Select ${entry.name}`}
                                    aria-label={`Template ${index + 1}: ${entry.name}, ${status}`}
                                    onClick={() => {
                                        if (!draggedTemplateId) setSelectedRegisteredId(entry.id);
                                    }}
                                    onKeyDown={event => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelectedRegisteredId(entry.id);
                                        }
                                    }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                                        borderRadius: 4, cursor: registryLocked ? "default" : "pointer",
                                        background: isSelected ? "#3c5a78" : "#252525",
                                        border: draggedTemplateId === entry.id ? "1px dashed #61aef7" : (isSelected ? "1px solid #61aef7" : "1px solid #444"),
                                        opacity: draggedTemplateId === entry.id ? 0.65 : 1
                                    }}
                                >
                                    <div
                                        className="template-drag-handle"
                                        ref={node => {
                                            if (node && !renderedDragHandlesRef.current.has(entry.id)) {
                                                renderedDragHandlesRef.current.add(entry.id);
                                                console.info("TEMPLATE_DRAG_HANDLE_RENDERED", JSON.stringify({
                                                    templateId: entry.id,
                                                    sourceIndex: index,
                                                    disabled: registryLocked
                                                }));
                                            }
                                        }}
                                        role="button"
                                        tabIndex={registryLocked ? -1 : 0}
                                        aria-disabled={registryLocked}
                                        title={`Drag to reorder ${entry.name}`}
                                        aria-label={`Drag handle for ${entry.name}`}
                                        onClick={event => event.stopPropagation()}
                                        onMouseDown={event => beginTemplateMouseDrag(event, entry, index)}
                                        onKeyDown={event => {
                                            if (event.key === "Escape" && dragStateRef.current) {
                                                clearTemplateDrag({ cancelled: true, reason: "escape" });
                                            }
                                        }}
                                        style={{ cursor: registryLocked ? "not-allowed" : "grab", touchAction: "none", pointerEvents: "auto", userSelect: "none" }}
                                    >☰</div>
                                    <span aria-label={`Order ${index + 1}`}>{index + 1}</span>
                                    <span style={{ flex: 1 }}>{entry.name}</span>
                                    <span title={`Validation status: ${status}`} aria-label={`Status ${status}`} style={{ fontSize: 11, color: statusBlocked ? "#ff9999" : "#9ee6a5" }}>{status}</span>
                                    <button title={`Move ${entry.name} up`} aria-label={`Move ${entry.name} up`} disabled={registryLocked || index === 0} onClick={event => { event.stopPropagation(); moveRegisteredTemplate(entry.id, index - 1, "keyboard"); }}>↑</button>
                                    <button title={`Move ${entry.name} down`} aria-label={`Move ${entry.name} down`} disabled={registryLocked || index === registeredTemplates.length - 1} onClick={event => { event.stopPropagation(); moveRegisteredTemplate(entry.id, index + 1, "keyboard"); }}>↓</button>
                                    <button title={`Remove ${entry.name}`} aria-label={`Remove ${entry.name}`} disabled={registryLocked} onClick={event => { event.stopPropagation(); removeSelectedRegisteredTemplate(entry.id); }}>×</button>
                                </div>
                                {isDropAfter && <div className="drop-after" style={{ height: 2, background: "#4da3ff", marginTop: 3 }} />}
                            </div>
                        );
                    })}
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
                    disabled={!canProcessProject({
                        hasProject,
                        isExecuting,
                        entries: registeredTemplates,
                        preflight: registryPreflightState
                    })}
                >
                    {isExecuting ? "Processing…" : "Process Project"}
                </button>
                </div>

                <BatchProgressPanel summary={projectExecutionSummary} onRequestCancel={requestBatchCancellation} />

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
