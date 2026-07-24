import ThumbnailService from "../services/ThumbnailService";
import RefreshService from "../services/RefreshService";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

const MAX_CONCURRENT = 2;
const REFRESH_BATCH_SIZE = 6;
const REFRESH_INTERVAL_MS = 75;

const PRIORITY = Object.freeze({
    SELECTED: 0,
    VISIBLE: 1,
    REMAINING: 2
});

class ThumbnailQueue {

    constructor() {

        this.queues = [[], [], []];
        this.queued = new Set();
        this.active = new Set();
        this.activeGenerations = new Map();
        this.running = 0;
        this.generation = 0;
        this.discardedGenerations = new Set();
        this.timings = new Map();
        this.onThumbnailReady = null;
        this.completedSinceRefresh = 0;
        this.refreshTimer = null;

    }

    add(photo, priority = PRIORITY.REMAINING) {

        if (
            !photo ||
            photo.loaded ||
            this.active.has(photo) ||
            this.queued.has(photo)
        ) return;

        this.queues[priority].push(photo);
        this.queued.add(photo);

        if (!this.timings.has(photo)) {
            this.timings.set(photo, {
                queuedAt:
                    PhotoBrowserPerformance.timestamp()
            });
        }
        this.process();

    }

    addBatch(photos = [], priority = PRIORITY.REMAINING) {

        for (const photo of photos) {
            this.add(photo, priority);
        }

    }

    addPriority(photo) {

        this.reprioritize(photo, PRIORITY.SELECTED);

    }

    setVisible(photos = []) {

        for (const photo of photos) {
            this.reprioritize(photo, PRIORITY.VISIBLE);
        }

    }

    reprioritize(photo, priority) {

        if (
            !photo ||
            photo.loaded ||
            this.active.has(photo)
        ) return;

        if (this.queued.has(photo)) {
            for (const queue of this.queues) {
                const index = queue.indexOf(photo);
                if (index >= 0) queue.splice(index, 1);
            }
            this.queued.delete(photo);
        }

        this.add(photo, priority);

    }

    process() {

        while (
            this.running < MAX_CONCURRENT &&
            this.size() > 0
        ) {
            const photo = this.next();
            const generation = this.generation;

            if (!photo) break;

            this.running++;
            this.queued.delete(photo);
            this.active.add(photo);
            this.activeGenerations.set(photo, generation);
            const performanceSession =
                PhotoBrowserPerformance.thumbnailStarted();
            const timing = this.timings.get(photo) || {};
            timing.startedAt =
                PhotoBrowserPerformance.timestamp();
            this.timings.set(photo, timing);

            PhotoBrowserPerformance.trace(
                "QUEUE_CALLBACK_ENTER",
                {
                    name: photo.name || "unnamed",
                    generation,
                    currentGeneration: this.generation,
                    cancelled:
                        generation !== this.generation
                }
            );
            this.processPhoto(
                photo,
                generation,
                performanceSession
            );
        }

    }

    next() {

        for (const queue of this.queues) {
            if (queue.length) return queue.shift();
        }

        return null;

    }

    async processPhoto(
        photo,
        generation,
        performanceSession
    ) {

        PhotoBrowserPerformance.trace(
            "QUEUE_JOB_BEGIN",
            {
                name: photo.name || "unnamed",
                generation
            }
        );

        try {
            const timing = this.timings.get(photo) || {};
            timing.serviceStart =
                PhotoBrowserPerformance.timestamp();
            const thumbnail =
                await ThumbnailService.getThumbnail(photo);
            timing.serviceEnd =
                PhotoBrowserPerformance.timestamp();
            this.timings.set(photo, timing);

            if (
                thumbnail &&
                generation === this.generation
            ) {
                photo.setThumbnail?.(thumbnail);
                photo.thumbnail = thumbnail;
                photo.loaded = true;

                if (
                    ThumbnailService.isPlaceholder(thumbnail)
                ) {
                    PhotoBrowserPerformance.thumbnailVisible(
                        photo.id
                    );
                }

                if (typeof this.onThumbnailReady === "function") {
                    this.onThumbnailReady(photo);
                }
            } else if (
                thumbnail &&
                this.discardedGenerations.has(generation)
            ) {
                ThumbnailService.removeThumbnail(photo);
            }
        } catch (error) {
            console.error("ThumbnailQueue:", error);
        } finally {
            photo.loading = false;
            this.active.delete(photo);
            this.activeGenerations.delete(photo);
            this.running = Math.max(0, this.running - 1);
            if (
                ![...this.activeGenerations.values()]
                    .includes(generation)
            ) {
                this.discardedGenerations.delete(generation);
            }
            this.scheduleRefresh();
            const timing = this.timings.get(photo) || {};
            timing.callbackEnd =
                PhotoBrowserPerformance.timestamp();
            PhotoBrowserPerformance.trace(
                "QUEUE_JOB_END",
                {
                    name: photo.name || "unnamed",
                    generation,
                    currentGeneration: this.generation,
                    accepted:
                        generation === this.generation,
                    queueWaitMs: this.elapsed(
                        timing.queuedAt,
                        timing.startedAt
                    ),
                    serviceMs: this.elapsed(
                        timing.serviceStart,
                        timing.serviceEnd
                    ),
                    callbackMs: this.elapsed(
                        timing.serviceEnd,
                        timing.callbackEnd
                    )
                }
            );
            this.timings.delete(photo);
            PhotoBrowserPerformance.thumbnailCompleted(
                performanceSession
            );
            this.process();
        }

    }

    scheduleRefresh() {

        this.completedSinceRefresh++;

        if (
            this.completedSinceRefresh >= REFRESH_BATCH_SIZE
        ) {
            this.flushRefresh();
            return;
        }

        if (!this.refreshTimer) {
            this.refreshTimer = setTimeout(
                () => this.flushRefresh(),
                REFRESH_INTERVAL_MS
            );
        }

    }

    flushRefresh() {

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        if (!this.completedSinceRefresh) return;

        this.completedSinceRefresh = 0;
        PhotoBrowserPerformance.refresh();
        RefreshService.refresh("thumbnails");

    }

    setListener(callback) {

        this.onThumbnailReady = callback;

    }

    clear({ discardResults = true } = {}) {

        PhotoBrowserPerformance.trace(
            "QUEUE_CANCEL",
            {
                generation: this.generation,
                queued: this.size(),
                active: this.active.size,
                discardResults
            }
        );

        if (discardResults) {
            this.discardedGenerations.add(this.generation);

            if (
                ![...this.activeGenerations.values()]
                    .includes(this.generation)
            ) {
                this.discardedGenerations.delete(
                    this.generation
                );
            }
        }
        this.generation++;
        this.queues.forEach(queue => {
            queue.forEach(photo => {
                this.timings.delete(photo);
            });
            queue.length = 0;
        });
        this.queued.clear();
        this.flushRefresh();

    }

    size() {

        return this.queues.reduce(
            (total, queue) => total + queue.length,
            0
        );

    }

    isBusy() {

        return this.running > 0 || this.size() > 0;

    }

    elapsed(start, end) {

        if (start == null || end == null) return null;

        return Math.round((end - start) * 10) / 10;

    }

}

export default new ThumbnailQueue();
