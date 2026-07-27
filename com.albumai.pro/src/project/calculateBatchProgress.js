const STAGE_WEIGHTS = Object.freeze({
    OPENING: 10,
    VALIDATING: 15,
    PLANNING: 20,
    REPLACING: 55,
    SAVING: 75,
    AUTOSAVING: 75,
    EXPORTING: 90,
    CLOSING: 95,
    COMPLETED: 0
});

/** Calculate deterministic, bounded project-batch progress from its summary. */
export default function calculateBatchProgress(summary) {
    const progress = summary?.batchProgress || {};
    const status = progress.lifecycle || summary?.batchExecution?.status || summary?.status || "IDLE";
    const total = Number(progress.totalTemplates ?? summary?.totalTemplates) || 0;
    const completed = Math.max(0, Number(progress.completedTemplates ?? summary?.completedTemplates) || 0);
    if (!total) return 0;
    if (["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(status) && completed >= total) return 100;
    const stageWeight = STAGE_WEIGHTS[progress.stage] || 0;
    const value = ((completed + stageWeight / 100) / total) * 100;
    // A running batch must reserve 100% for its terminal summary.
    return Math.max(0, Math.min(status === "RUNNING" || status === "PREPARING" ? 99 : 100, Math.round(value)));
}
