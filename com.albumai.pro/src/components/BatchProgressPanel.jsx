import React, { useEffect, useMemo, useRef } from "react";
import calculateBatchProgress from "../project/calculateBatchProgress";

const STAGE_LABELS = Object.freeze({
    IDLE: "Ready", PREPARING: "Preparing", OPENING: "Opening Template",
    VALIDATING: "Preparing", PLANNING: "Planning Placement",
    REPLACING: "Replacing Photos", SAVING: "Saving PSD", AUTOSAVING: "Saving PSD",
    EXPORTING: "Exporting", CLOSING: "Closing Template", COMPLETED: "Completed", FAILED: "Failed"
});

function statusFor(summary) {
    return summary?.batchProgress?.lifecycle || summary?.batchExecution?.status || summary?.status || "IDLE";
}

export default function BatchProgressPanel({ summary }) {
    const lastDiagnostic = useRef(null);
    const status = statusFor(summary);
    const progress = summary?.batchProgress || {};
    const total = Number(progress.totalTemplates ?? summary?.totalTemplates) || 0;
    const completed = Number(progress.completedTemplates ?? summary?.completedTemplates) || 0;
    const successful = Number(progress.successfulTemplates ?? summary?.successfulTemplates) || 0;
    const failed = Number(progress.failedTemplates ?? summary?.failedTemplates) || 0;
    const skipped = Number(progress.skippedTemplates ?? summary?.skippedTemplates) || 0;
    const remaining = Math.max(0, Number(progress.remainingTemplates ?? (total - completed)) || 0);
    const percent = calculateBatchProgress(summary);
    const current = progress.currentTemplate;
    const terminal = ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(status);
    const visible = ["PREPARING", "RUNNING", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(status);
    const title = status === "COMPLETED" ? "Project Completed" :
        status === "COMPLETED_WITH_ERRORS" ? "Completed with Errors" :
            status === "FAILED" ? "Project Failed" : "Project Processing";
    const templateName = terminal && status !== "FAILED" ? "All Templates Completed" : (current?.name || "—");
    const templatePosition = progress.templateIndex == null ? "—" : `${progress.templateIndex + 1} of ${total}`;
    const stage = STAGE_LABELS[progress.stage] || STAGE_LABELS[status] || "Ready";
    const fatalError = summary?.batchExecution?.fatalError || summary?.fatalError || summary?.registryValidationError;
    const warning = summary?.batchExecution?.warnings?.[0] || summary?.warnings?.[0] || null;
    const diagnostic = useMemo(() => JSON.stringify({
        batchStatus: status, currentStage: progress.stage || "IDLE", currentTemplate: current?.name || null,
        templateIndex: progress.templateIndex, totalTemplates: total, completed, successful, failed,
        skipped, remaining, progressPercent: percent
    }), [status, progress.stage, current?.name, progress.templateIndex, total, completed, successful, failed, skipped, remaining, percent]);

    useEffect(() => {
        console.info("ALB-033-live-batch-progress-ui-v1");
        console.info("BATCH_PROGRESS_UI_MOUNTED");
    }, []);

    useEffect(() => {
        if (!visible || diagnostic === lastDiagnostic.current) return;
        lastDiagnostic.current = diagnostic;
        console.info("BATCH_PROGRESS_UI_UPDATED", diagnostic);
        if (terminal) console.info("BATCH_PROGRESS_UI_COMPLETED", diagnostic);
    }, [visible, terminal, diagnostic]);

    if (!visible) return null;

    const tone = status === "FAILED" ? "#ff8f8f" : status === "COMPLETED_WITH_ERRORS" ? "#f4c76b" : status === "COMPLETED" ? "#8ce09b" : "#d7e8ff";
    return <section style={{ marginTop: 10, padding: 10, borderRadius: 5, background: "#252525", border: `1px solid ${tone}`, fontSize: 12 }} aria-label="Project processing progress">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: tone, fontWeight: 600 }}><span>{title}</span><span>{percent}%</span></div>
        <div style={{ marginTop: 7 }}>Template: {templateName}</div>
        <div>Template {templatePosition}</div>
        <div>Stage: {stage}</div>
        <div role="progressbar" aria-label="Project processing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={{ marginTop: 7, height: 8, overflow: "hidden", borderRadius: 4, background: "#444" }}>
            <div style={{ width: `${percent}%`, height: "100%", background: tone }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 7 }}>
            <span>Completed: {completed}</span><span>Successful: {successful}</span><span>Failed: {failed}</span><span>Skipped: {skipped}</span><span>Remaining: {remaining}</span>
        </div>
        {status === "COMPLETED" && <div style={{ marginTop: 6 }}>Project Completed — {successful} of {total} templates processed successfully</div>}
        {status === "COMPLETED_WITH_ERRORS" && <div style={{ marginTop: 6, color: tone }}>Successful: {successful} · Failed: {failed}</div>}
        {fatalError && <div style={{ marginTop: 6, color: "#ff9999" }}>{fatalError}</div>}
        {warning && <div style={{ marginTop: 6, color: "#f4c76b" }}>{warning}</div>}
    </section>;
}
