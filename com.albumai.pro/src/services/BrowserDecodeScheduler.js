import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

// Software JPEG decoding temporarily holds the source pixel buffer. Keep a
// single decode active so large camera files cannot multiply that peak.
const MAX_CONCURRENT = 1;
const MAX_CONSECUTIVE_PREVIEW_JOBS = 2;
const DEFAULT_TIMEOUT_MS = 15000;

class BrowserDecodeScheduler {

    constructor() {

        this.active = 0;
        this.pending = [];
        this.jobs = new Map();
        this.consecutivePreviewJobs = 0;
        this.idleResolvers = new Set();

    }

    get activeCount() {

        return this.active;

    }

    snapshot() {

        let activePreviewDecodes = 0;
        for (const job of this.jobs.values()) {
            if (job.active && job.priority === 0) {
                activePreviewDecodes++;
            }
        }
        return {
            activeBrowserDecodes:
                Math.max(0, this.active - activePreviewDecodes),
            activePreviewDecodes,
            pendingJobs: this.pending.length + this.active
        };

    }

    request(key, start, {
        priority = 2,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        onTimeout = null,
        onCancel = null,
        generation = null
    } = {}) {

        if (this.jobs.has(key)) return false;

        const job = {
            key,
            start,
            priority,
            onTimeout,
            onCancel,
            timeoutMs,
            generation,
            released: false,
            cancelled: false,
            timer: null
        };
        this.jobs.set(key, job);
        this.pending.push(job);
        this.pending.sort((left, right) =>
            left.priority - right.priority
        );
        this.process();
        return true;

    }

    cancel(key) {

        const job = this.jobs.get(key);
        if (!job || job.cancelled) return;

        const index = this.pending.indexOf(job);
        if (index >= 0) this.pending.splice(index, 1);
        job.cancelled = true;
        if (job.timer != null) {
            clearTimeout(job.timer);
            job.timer = null;
        }
        job.onCancel?.({ active: job.active });
        // An active File.read/render promise cannot be interrupted safely.
        // Keep its scheduler slot and job identity until its own finally()
        // releases it, so runtime summaries never report a detached render.
        if (!job.active) this.release(job);

    }

    reprioritize(key, priority) {

        const job = this.jobs.get(key);
        if (!job || job.active || job.priority <= priority) return;
        job.priority = priority;
        this.pending.sort((left, right) =>
            left.priority - right.priority
        );

    }

    process() {

        while (this.active < MAX_CONCURRENT && this.pending.length) {
            let nextIndex = 0;
            if (
                this.consecutivePreviewJobs >=
                    MAX_CONSECUTIVE_PREVIEW_JOBS
            ) {
                const browserIndex = this.pending.findIndex(
                    pendingJob => pendingJob.priority > 0
                );
                if (browserIndex >= 0) nextIndex = browserIndex;
            }
            const [job] = this.pending.splice(nextIndex, 1);
            if (!this.jobs.has(job.key)) continue;

            job.active = true;
            if (job.priority === 0) {
                this.consecutivePreviewJobs++;
            } else {
                this.consecutivePreviewJobs = 0;
            }
            this.active++;
            PhotoBrowserPerformance.trace("ACTIVE_BROWSER_DECODES", {
                active: this.active
            });
            job.timer = setTimeout(() => {
                if (job.released) return;
                job.onTimeout?.();
            }, job.timeoutMs);
            try {
                job.start(() => this.release(job));
            } catch (error) {
                this.release(job);
                throw error;
            }
        }

    }

    release(job) {

        if (job.released) return;

        job.released = true;
        if (job.timer != null) {
            clearTimeout(job.timer);
            job.timer = null;
        }
        this.jobs.delete(job.key);
        if (job.active) {
            this.active = Math.max(0, this.active - 1);
            PhotoBrowserPerformance.trace("ACTIVE_BROWSER_DECODES", {
                active: this.active
            });
        }
        this.process();
        this.resolveIdle();

    }

    whenIdle() {

        if (!this.jobs.size && !this.pending.length && !this.active) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.idleResolvers.add(resolve);
        });

    }

    resolveIdle() {

        if (this.jobs.size || this.pending.length || this.active) return;
        for (const resolve of this.idleResolvers) resolve();
        this.idleResolvers.clear();

    }

}

export default new BrowserDecodeScheduler();
