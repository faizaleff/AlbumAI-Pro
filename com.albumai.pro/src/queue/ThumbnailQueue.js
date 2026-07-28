import ThumbnailService from "../services/ThumbnailService";
import RefreshService from "../services/RefreshService";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

const MAX_CONCURRENT = 2;
const REFRESH_BATCH_SIZE = 6;
const REFRESH_INTERVAL_MS = 75;

export const ThumbnailPriority = Object.freeze({
    SELECTED: 0,
    VISIBLE: 1,
    OVERSCAN: 2,
    REMAINING: 3
});

class ThumbnailQueue {

    constructor() {

        this.queues = [[], [], [], []];
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
        this.viewportPhotos = new Set();
        this.cancelled = new Set();

    }

    add(photo, priority = ThumbnailPriority.REMAINING) {

        if (
            !photo ||
            photo.loaded ||
            photo.thumbnailUnavailable === true ||
            this.active.has(photo) ||
            this.queued.has(photo)
        ) return;

        const cached = ThumbnailService.getCachedThumbnail(photo, {
            diagnostic: false
        });

        if (cached) {
            photo.setThumbnail?.(cached);
            photo.thumbnail = cached;
            photo.loaded = true;
            PhotoBrowserPerformance.trace("THUMB_MODEL_UPDATED", {
                photoId: photo?.id || null,
                cacheKey: null,
                resultStatus: "CACHE_HIT",
                sourceType: typeof cached,
                sourcePresent: true,
                generation: this.generation,
                cacheSize: null
            });
            return;
        }

        // With no compliant source producer, a cache miss is a final browser
        // placeholder state. Avoid creating thousands of no-op queue jobs.
        photo.thumbnailUnavailable = true;
        photo.loaded = true;
        return;

    }

    addBatch(photos = [], priority = ThumbnailPriority.REMAINING) {

        for (const photo of photos) {
            this.add(photo, priority);
        }

    }

    addPriority(photo) {

        this.reprioritize(photo, ThumbnailPriority.SELECTED);

    }

    setVisible(photos = []) {

        for (const photo of photos) {
            this.reprioritize(photo, ThumbnailPriority.VISIBLE);
        }

    }

    setViewport({ visible = [], overscan = [] } = {}) {

        this.viewportPhotos = new Set([...visible, ...overscan]);
        this.cancelOutsideViewport();

        for (const photo of overscan) {
            this.reprioritize(photo, ThumbnailPriority.OVERSCAN);
        }

        for (const photo of visible) {
            this.reprioritize(photo, ThumbnailPriority.VISIBLE);
        }

    }

    cancelOutsideViewport() {

        for (const queue of this.queues) {
            for (let index = queue.length - 1; index >= 0; index -= 1) {
                const photo = queue[index];
                if (!this.viewportPhotos.has(photo)) {
                    queue.splice(index, 1);
                    this.queued.delete(photo);
                    this.timings.delete(photo);
                }
            }
        }

        for (const photo of this.active) {
            if (!this.viewportPhotos.has(photo)) {
                this.cancelled.add(photo);
            }
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
            this.cancelled.delete(photo);
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
            PhotoBrowserPerformance.trace("ACTIVE_THUMBNAIL_JOBS", {
                active: this.running
            });
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
            const result = ThumbnailService.getThumbnailResult(photo);
            const thumbnail = result.source;
            timing.serviceEnd =
                PhotoBrowserPerformance.timestamp();
            this.timings.set(photo, timing);

            if (
                result.status === "CACHE_HIT" &&
                thumbnail &&
                generation === this.generation
            ) {
                photo.setThumbnail?.(thumbnail);
                photo.thumbnail = thumbnail;
                photo.loaded = true;
                PhotoBrowserPerformance.trace("THUMB_MODEL_UPDATED", {
                    photoId: photo?.id || null,
                    cacheKey: result.cacheKey,
                    resultStatus: result.status,
                    sourceType: typeof thumbnail,
                    sourcePresent: true,
                    generation,
                    cacheSize: null
                });

                if (
                    !this.cancelled.has(photo) &&
                    typeof this.onThumbnailReady === "function"
                ) {
                    this.onThumbnailReady(photo);
                }
            } else if (
                result.status === "UNSUPPORTED" &&
                generation === this.generation &&
                !this.cancelled.has(photo)
            ) {
                // Browser tiles are cached-thumbnail-only. Do not requeue an
                // uncached file when the host cannot generate one without
                // opening a Photoshop document.
                photo.thumbnailUnavailable = true;
                photo.loaded = true;
            } else {
                PhotoBrowserPerformance.trace("THUMB_STALE_RESULT_IGNORED", {
                    photoId: photo?.id || null,
                    cacheKey: null,
                    generation,
                    viewMode: null,
                    visible: this.viewportPhotos.has(photo)
                });
            }
        } catch (error) {
            console.error("ThumbnailQueue:", error);
        } finally {
            photo.loading = false;
            this.cancelled.delete(photo);
            this.active.delete(photo);
            this.activeGenerations.delete(photo);
            this.running = Math.max(0, this.running - 1);
            PhotoBrowserPerformance.trace("ACTIVE_THUMBNAIL_JOBS", {
                active: this.running
            });
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
        this.viewportPhotos.clear();
        this.cancelled.clear();
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
