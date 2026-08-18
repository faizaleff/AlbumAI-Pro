import React, { useEffect, useMemo, useRef, useState } from "react";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

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

export function summaryText({
    hasProject,
    projectId,
    projectName,
    photos = [],
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
    const allTemplatesProcessed = ["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(
        terminalBatch?.status
    );
    const currentTemplateName = allTemplatesProcessed
        ? "All Templates Completed"
        : terminalBatch?.currentTemplate?.name ||
            projectExecutionSummary?.batchProgress?.currentTemplate?.name ||
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
    const recoveryOutputs = recoveryState?.outputRecovery;
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
        `Committed Outputs: ${recoveryOutputs?.counts?.COMMITTED || 0}`,
        `Safe Retry Outputs: ${recoveryOutputs?.counts?.SAFE_RETRY || 0}`,
        `Commit Unknown: ${recoveryOutputs?.counts?.COMMIT_UNKNOWN || 0}`,
        `Cleanup Required: ${recoveryOutputs?.counts?.REMEDIATION_REQUIRED || 0}`,
        `Last Template: ${textValue(recoveryTemplateName)}`,
        `Last Stage: ${textValue(recovery?.lastCompletedStage)}`,
        `Resume/Retry Result: ${textValue(recovery?.runMode)}`
    );

    return lines.join("\n");
}

export function debugText({
    projectId,
    projectName,
    photos = [],
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
        `Output Path: ${textValue(batchAutoSave?.outputPath, "None")}`,
        `Warnings: ${(batchAutoSave?.warnings || []).join(" | ") || "None"}`,
        `Error: ${textValue(batchAutoSave?.error, "None")}`,
        "",
        "Export Result",
        `Status: ${textValue(batchExport?.status)}`,
        `Output Path: ${textValue(batchExport?.outputPath, "None")}`,
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
        `Template Progress: ${projectExecutionSummary?.batchProgress?.templateIndex == null ? "—" : `${projectExecutionSummary.batchProgress.templateIndex + 1} / ${projectExecutionSummary.batchProgress.totalTemplates}`}`,
        `Remaining Templates: ${textValue(projectExecutionSummary?.batchProgress?.remainingTemplates, "0")}`,
        `Progress: ${textValue(projectExecutionSummary?.batchProgress?.percentage, "0")}%`,
        `Registry Validation: ${textValue(projectExecutionSummary?.registryValidationError, "None")}`,
        "Project Template Registry",
        ...(registeredTemplates.length
            ? registeredTemplates.map((template, index) =>
                `${index + 1}. ${textValue(template.id)} — ${textValue(template.name)}: ${textValue(template.validationState)}`
            )
            : ["None"]),
        "Template Results",
        ...(projectExecutionSummary?.batchExecution?.templateResults || []).map(result =>
            `${textValue(result.templateId)} — ${textValue(result.templateName)} [document=${textValue(result.documentContext?.documentId)}]: ${textValue(result.status)}${result.photoAllocation ? ` [${result.photoAllocation.assignedCount ? `photos ${result.photoAllocation.startCursor + 1}-${result.photoAllocation.endCursor}` : "photos: none"}, assigned=${result.photoAllocation.assignedCount}, remaining=${result.photoAllocation.remainingCount}]` : ""}${result.error ? ` (${result.error})` : ""}`
        ),
        "",
        "Errors & Warnings",
        `Registry: ${textValue(registryError || projectExecutionSummary?.registryValidationError, "None")}`,
        `Placement: ${textValue(placementError, "None")}`,
        `Replacement: ${(batchRequest?.errors || []).join(" | ") || "None"}`,
        `Batch Errors: ${(batchExecutionSummary?.errors || []).join(" | ") || "None"}`
    );

    const recovery = recoveryState?.snapshot;
    const recoveryOutputs = recoveryState?.outputRecovery;
    const recoveryTemplateName = registeredTemplates.find(
        item => item.id === recovery?.currentTemplateId
    )?.name || recovery?.currentTemplateId;
    lines.push(
        "",
        "Recovery Diagnostics",
        `Available: ${recoveryState?.available ? "Yes" : "No"}`,
        `Classification: ${textValue(recoveryState?.classification, "NONE")}`,
        `Batch ID: ${textValue(recovery?.batchId)}`,
        `Status: ${textValue(recovery?.lifecycle)}`,
        `Run Mode: ${textValue(recovery?.runMode)}`,
        `Completed/Success/Failed/Skipped/Pending: ${recovery?.completedTemplateIds?.length || 0}/${recovery?.successfulTemplateIds?.length || 0}/${recovery?.failedTemplateIds?.length || 0}/${(recovery?.templateOutcomes || []).filter(item => item.status === "SKIPPED_NO_PHOTOS").length}/${recovery?.pendingTemplateIds?.length || 0}`,
        `Last Template: ${textValue(recoveryTemplateName)}`,
        `Last Stage: ${textValue(recovery?.lastCompletedStage)}`,
        `Output States (Committed/Safe Retry/Commit Unknown/Cleanup Required): ${recoveryOutputs?.counts?.COMMITTED || 0}/${recoveryOutputs?.counts?.SAFE_RETRY || 0}/${recoveryOutputs?.counts?.COMMIT_UNKNOWN || 0}/${recoveryOutputs?.counts?.REMEDIATION_REQUIRED || 0}`,
        `Automatic Retry Templates: ${recoveryOutputs?.automaticRetryTemplates || 0}`,
        `Blocked Templates: ${recoveryOutputs?.blockedTemplates || 0}`,
        `Remediation Templates: ${recoveryOutputs?.remediationTemplates || 0}`,
        `Warnings: ${(recovery?.warnings || []).join(" | ") || "None"}`,
        `Fatal Error: ${textValue(recovery?.fatalError, "None")}`,
        "Recovery Template Outcomes",
        ...(recovery?.templateOutcomes || []).map(item =>
            `${textValue(item.templateId)} — ${textValue(item.templateName)}: ${textValue(item.status)}${item.photoAllocation ? ` [${item.photoAllocation.assignedCount ? `photos ${item.photoAllocation.startCursor + 1}-${item.photoAllocation.endCursor}` : "photos: none"}, assigned=${item.photoAllocation.assignedCount}, remaining=${item.photoAllocation.remainingCount}]` : ""}${item.error ? ` (${item.error})` : ""}`
        ),
        "Output Recovery States",
        ...(recoveryOutputs?.rows?.length ? recoveryOutputs.rows : [{ templateName: "None", output: "—", label: "—", reasonCode: null }]).map(item =>
            `${textValue(item.templateName)} — ${textValue(item.output)}: ${textValue(item.label)}${item.reasonCode ? ` (${item.reasonCode})` : ""}`
        )
    );

    return lines.join("\n");
}

export function ExecutionDetails({
    hasProject,
    projectId,
    projectName,
    healthPhotos = [],
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
    const outputRecovery = recoveryState?.outputRecovery || {
        counts: { COMMITTED: 0, SAFE_RETRY: 0, COMMIT_UNKNOWN: 0, REMEDIATION_REQUIRED: 0 },
        rows: [], automaticRetryTemplates: 0, skippedCommittedTemplates: 0,
        blockedTemplates: 0, remediationTemplates: 0, automaticRetryBlocked: false
    };
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
        } catch (_) {
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
                    const invalidRecovery = ["STALE", "INCOMPATIBLE", "INVALID"].includes(classification);
                    const retryRecovery = runMode === "RETRY_FAILED";

                    const showResume = recoveryAvailable &&
                        !invalidRecovery &&
                        !retryRecovery &&
                        pendingCount > 0 &&
                        outputRecovery.automaticRetryTemplates > 0 &&
                        ["RUNNING", "INTERRUPTED", "CANCELLED"].includes(lifecycle);

                    const showRetry = recoveryAvailable &&
                        !invalidRecovery &&
                        failedCount > 0 &&
                        outputRecovery.automaticRetryTemplates > 0 &&
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
                            ? "Recovery state no longer matches this project or template registry. Clear it before starting a new batch."
                            : (classification === "INVALID"
                                ? "Recovery data is invalid. Automatic resume and retry are blocked; clear the recovery state before starting again."
                                : "Recovery state was created by a newer unsupported version. Update AlbumAI before using this recovery state.");
                    } else if (showRetry) {
                        recoveryMessage = `${failedCount} failed template${failedCount === 1 ? "" : "s"} ready to retry.`;
                    } else if (showResume) {
                        recoveryMessage = `Batch stopped with ${completedCount} completed and ${pendingCount} remaining.`;
                    } else if (outputRecovery.remediationTemplates > 0) {
                        recoveryMessage = "Cleanup is required before affected templates can be retried.";
                    } else if (outputRecovery.blockedTemplates > 0) {
                        recoveryMessage = "One or more output commits are unknown. Automatic retry is blocked.";
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
                        <Row label="Committed Outputs" value={outputRecovery.counts.COMMITTED} />
                        <Row label="Safe Retry Outputs" value={outputRecovery.counts.SAFE_RETRY} />
                        <Row label="Commit Unknown" value={outputRecovery.counts.COMMIT_UNKNOWN} warning={outputRecovery.counts.COMMIT_UNKNOWN > 0} />
                        <Row label="Cleanup Required" value={outputRecovery.counts.REMEDIATION_REQUIRED} warning={outputRecovery.counts.REMEDIATION_REQUIRED > 0} />
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

                        {outputRecovery.rows.map((item, index) => (
                            <Row
                                key={`output-recovery-${item.templateId || index}-${item.output}`}
                                label={`${item.templateName}: ${item.output}`}
                                value={`${item.label} — ${item.message}${item.reasonCode ? ` (${item.reasonCode})` : ""}`}
                                warning={["COMMIT_UNKNOWN", "REMEDIATION_REQUIRED"].includes(item.state)}
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
                                    {recoveryBusy ? "Resuming…" : "Resume Safe Templates"}
                                </button>
                            )}

                            {showRetry && (
                                <button
                                    type="button"
                                    onClick={onRetryFailed}
                                    disabled={recoveryBusy}
                                >
                                    {recoveryBusy ? "Retrying…" : "Retry Safe Failed Templates"}
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

export default function ExecutionDetailsPanel(props) {
    return <ExecutionDetails {...props} />;
}
