import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const MAX_CONCURRENT = 2;
const DEFAULT_TIMEOUT_MS = 15000;

class BrowserDecodeScheduler {

    constructor() {

        this.active = 0;
        this.pending = [];
        this.jobs = new Map();

    }

    get activeCount() {

        return this.active;

    }

    request(key, start, {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        onTimeout = null,
        onCancel = null
    } = {}) {

        if (this.jobs.has(key)) return false;

        const job = {
            key,
            start,
            onTimeout,
            onCancel,
            timeoutMs,
            released: false,
            timer: null
        };
        this.jobs.set(key, job);
        this.pending.push(job);
        this.process();
        return true;

    }

    cancel(key) {

        const job = this.jobs.get(key);
        if (!job) return;

        const index = this.pending.indexOf(job);
        if (index >= 0) this.pending.splice(index, 1);
        job.onCancel?.();
        this.release(job);

    }

    process() {

        while (this.active < MAX_CONCURRENT && this.pending.length) {
            const job = this.pending.shift();
            if (!this.jobs.has(job.key)) continue;

            job.active = true;
            this.active++;
            PhotoBrowserPerformance.trace("ACTIVE_BROWSER_DECODES", {
                active: this.active
            });
            job.timer = setTimeout(() => {
                if (job.released) return;
                job.onTimeout?.();
                this.release(job);
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

    }

}

export default new BrowserDecodeScheduler();
