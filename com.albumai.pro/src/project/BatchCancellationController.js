export default class BatchCancellationController {
    constructor() { this.reset(); }
    reset() { this.requested = false; this.reason = null; this.requestedAt = null; this.effectiveAt = null; this.retainedProgressPercent = 0; }
    requestCancel(reason = "USER_REQUEST") {
        if (this.requested) return this.getSnapshot();
        this.requested = true;
        this.reason = reason;
        this.requestedAt = new Date().toISOString();
        return this.getSnapshot();
    }
    isCancellationRequested() { return this.requested; }
    markEffective() { if (!this.effectiveAt) this.effectiveAt = new Date().toISOString(); }
    captureProgress(percent) { this.retainedProgressPercent = Math.max(this.retainedProgressPercent, Math.min(99, Number(percent) || 0)); }
    getSnapshot() { return Object.freeze({ requested: this.requested, reason: this.reason, requestedAt: this.requestedAt, effectiveAt: this.effectiveAt, retainedProgressPercent: this.retainedProgressPercent }); }
}
