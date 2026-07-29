import ThumbnailCache from "../cache/ThumbnailCache";
import BrowserDecodeScheduler from "./BrowserDecodeScheduler";
import ImageSourceCapabilityService from "./ImageSourceCapabilityService";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";
import { getCanonicalPhotoEntry } from "./PhotoFileEntry";

const MAX_DIAGNOSTIC_SAMPLES = 10;
const PROFILE_CONFIGURATION = Object.freeze({
    thumbnail: {
        suffix: "thumb-200-v5",
        maxEdge: 200,
        quality: 0.60,
        priority: 1,
        successEvent: "THUMBNAIL_GENERATION_SUCCESS",
        failureEvent: "THUMBNAIL_GENERATION_FAILURE"
    },
    preview: {
        suffix: "preview-1000-v5",
        maxEdge: 1000,
        quality: 0.70,
        priority: 0,
        successEvent: "PREVIEW_GENERATION_SUCCESS",
        failureEvent: "PREVIEW_GENERATION_FAILURE"
    }
});

function timestampValue(value) {

    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (!value) return 0;
    return new Date(value).getTime() || 0;

}

function fileIdentity(photo) {

    if (!photo) return null;
    const { candidate } = getCanonicalPhotoEntry(photo);
    const identity = candidate?.nativePath ||
        photo.id ||
        candidate?.name ||
        photo.name;
    if (!identity) return null;

    const modified = timestampValue(
        photo.modified ||
        candidate?.modified ||
        candidate?.lastModified
    );
    const size = photo.fileSize || candidate?.size || 0;
    return `${identity}|${modified}|${size}`;

}

function profileConfiguration(profile) {

    return PROFILE_CONFIGURATION[profile] ||
        PROFILE_CONFIGURATION.thumbnail;

}

export function getThumbnailCacheKey(photo, profile = "thumbnail") {

    const identity = fileIdentity(photo);
    const configuration = profileConfiguration(profile);
    return identity ? `${identity}|${configuration.suffix}` : null;

}

function getSourceCacheKey(photo, profile) {

    return getThumbnailCacheKey(photo, profile);

}

function getContentCacheKey(contentIdentity, profile) {

    if (!contentIdentity) return null;
    const configuration = profileConfiguration(profile);
    return `jpeg-content-${contentIdentity}|${configuration.suffix}`;

}

function anonymizedPhotoIdentity(sourceKey) {

    let hash = 2166136261;
    const value = String(sourceKey || "unknown");
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `photo-${(hash >>> 0).toString(16).padStart(8, "0")}`;

}

function generationFailureReason(error) {

    const message = String(error?.message || "");
    if (message.includes("maxMemoryUsageInMB")) {
        return "DECODE_MEMORY_LIMIT";
    }
    if (message.includes("maxResolutionInMP")) {
        return "DECODE_RESOLUTION_LIMIT";
    }
    if (error?.name === "EmbeddedJpegUnavailableError") {
        return "EMBEDDED_JPEG_UNAVAILABLE";
    }
    if (error?.name === "EmbeddedPreviewUnsupportedFormatError") {
        return "UNSUPPORTED_FORMAT";
    }
    if (error?.name === "TimeoutError") return "TIMEOUT";
    return "IMAGE_GENERATION_FAILED";

}

class ThumbnailService {

    constructor() {

        this.generation = 0;
        this.workspaceGeneration = 0;
        this.acceptingRequests = false;
        this.inFlight = new Map();
        this.requestContexts = new Map();
        this.cacheAliases = new Map();
        this.cacheAliasCounts = new Map();
        this.failures = new Set();
        this.reportedFailures = new Set();
        this.loadStates = new Map();
        this.diagnosticCounts = new Map();
        if (
            typeof process === "undefined" ||
            process.env?.NODE_ENV !== "production"
        ) {
            globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__ =
                () => this.emitRuntimeSummary("explicit");
        }

    }

    getCachedThumbnail(photo, {
        profile = "thumbnail"
    } = {}) {

        const key = getThumbnailCacheKey(photo, profile);
        const sourceKey = getSourceCacheKey(photo, profile);
        return key
            ? this.getCachedSource(key) ||
                (
                    sourceKey !== key
                        ? this.getCachedSource(sourceKey)
                        : null
                )
            : null;

    }

    getSource(photo, {
        profile = "thumbnail",
        priority = null,
        workspaceGeneration = this.workspaceGeneration
    } = {}) {

        const key = getThumbnailCacheKey(photo, profile);
        const sourceKey = getSourceCacheKey(photo, profile);
        if (!key) {
            this.traceBounded(
                "IMAGE_SOURCE_RESOLUTION_FAILURE",
                profile,
                {
                    profile,
                    errorName: "MissingPhotoIdentity"
                }
            );
            return Promise.resolve(null);
        }
        if (
            !this.acceptingRequests ||
            workspaceGeneration !== this.workspaceGeneration
        ) {
            this.traceBounded(
                "STALE_IMAGE_REQUEST_REJECTED",
                `${profile}:inactive-workspace`,
                { profile, workspaceGeneration }
            );
            return Promise.resolve(null);
        }

        const cached = this.getCachedSource(key) ||
            (
                sourceKey !== key
                    ? this.getCachedSource(sourceKey)
                    : null
            );
        if (cached) {
            this.loadStates.set(key, "ready");
            PhotoBrowserPerformance.cacheHit();
            return Promise.resolve(cached);
        }
        PhotoBrowserPerformance.cacheMiss();

        const configuration = profileConfiguration(profile);
        const requestPriority = priority == null
            ? configuration.priority
            : priority;
        if (this.failures.has(sourceKey)) return Promise.resolve(null);
        if (this.inFlight.has(sourceKey)) {
            BrowserDecodeScheduler.reprioritize(
                sourceKey,
                requestPriority
            );
            return this.inFlight.get(sourceKey);
        }

        const requestGeneration = this.generation;
        const lifecycle = this.createRequestLifecycle({
            profile,
            requestGeneration,
            workspaceGeneration
        });
        let settleRequest = null;
        const pending = new Promise(resolve => {
            let settled = false;
            const finish = value => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            settleRequest = finish;

            const accepted = BrowserDecodeScheduler.request(
                sourceKey,
                release => {
                    ImageSourceCapabilityService.renderProfile(
                        photo,
                        {
                            maxEdge: configuration.maxEdge,
                            quality: configuration.quality,
                            lifecycle,
                            resolveCachedSource: contentIdentity => {
                                const cacheKey = getContentCacheKey(
                                    contentIdentity,
                                    profile
                                );
                                const source = cacheKey
                                    ? ThumbnailCache.get(cacheKey)
                                    : null;
                                return source
                                    ? { source, cacheKey }
                                    : null;
                            }
                        }
                    ).then(result => {
                        try {
                            lifecycle.throwIfCancelled(
                                "before-cache-publication"
                            );
                        } catch (error) {
                            this.traceBounded(
                                "STALE_IMAGE_RESULT_REJECTED",
                                `${profile}:stale`,
                                {
                                    profile,
                                    checkpoint:
                                        error && error.checkpoint,
                                    workspaceGeneration
                                }
                            );
                            if (result?.ownedObjectUrl) {
                                ImageSourceCapabilityService.dispose(
                                    result.source
                                );
                            }
                            finish(null);
                            return;
                        }

                        const cacheKey = result.cacheKey ||
                            getContentCacheKey(
                                result.contentIdentity,
                                profile
                            ) ||
                            key;
                        ThumbnailCache.set(cacheKey, result.source);
                        this.setCacheAlias(key, cacheKey);
                        this.loadStates.set(key, "ready");
                        PhotoBrowserPerformance.recordGenerationOutcome({
                            profile,
                            success: true
                        });
                        this.traceBounded(
                            configuration.successEvent,
                            `${profile}:success`,
                            {
                                profile,
                                width: result.width,
                                height: result.height,
                                format: result.format,
                                strategy: result.strategy,
                                reduced: result.reduced
                            }
                        );
                        finish(result.source);
                    }).catch(error => {
                        if (error?.name === "StaleImageRequestError") {
                            this.traceBounded(
                                "STALE_IMAGE_RESULT_REJECTED",
                                `${profile}:cancelled`,
                                {
                                    profile,
                                    checkpoint:
                                        error && error.checkpoint,
                                    workspaceGeneration
                                }
                            );
                        } else if (!lifecycle.isCancelled()) {
                            this.recordFailure(
                                photo,
                                profile,
                                sourceKey,
                                error
                            );
                        }
                        finish(null);
                    }).finally(release);
                },
                {
                    priority: requestPriority,
                    timeoutMs: 30000,
                    onTimeout: () => {
                        if (!lifecycle.isCancelled()) {
                            lifecycle.cancelled = true;
                            const error = new Error(
                                "Image generation timed out."
                            );
                            error.name = "TimeoutError";
                            this.recordFailure(
                                photo,
                                profile,
                                sourceKey,
                                error
                            );
                        }
                        finish(null);
                    },
                    onCancel: ({ active } = {}) => {
                        lifecycle.cancelled = true;
                        if (!active) {
                            try {
                                lifecycle.throwIfCancelled("before-read");
                            } catch (error) {
                                this.traceBounded(
                                    "STALE_IMAGE_RESULT_REJECTED",
                                    `${profile}:before-read`,
                                    {
                                        profile,
                                        checkpoint:
                                            error && error.checkpoint,
                                        workspaceGeneration
                                    }
                                );
                            }
                        }
                        finish(null);
                    },
                    generation: workspaceGeneration
                }
            );

            if (!accepted) {
                lifecycle.cancelled = true;
                finish(null);
            }
        }).finally(() => {
            if (this.inFlight.get(sourceKey) === pending) {
                this.inFlight.delete(sourceKey);
            }
            if (this.requestContexts.get(sourceKey) === lifecycle) {
                this.requestContexts.delete(sourceKey);
            }
        });

        this.loadStates.set(key, "loading");
        this.inFlight.set(sourceKey, pending);
        this.requestContexts.set(sourceKey, lifecycle);
        // Keep the cancellation closure alive until the scheduler accepts the
        // request. This also makes an immediate clear() deterministic.
        pending.cancel = () => settleRequest?.(null);
        return pending;

    }

    getThumbnail(photo, options = {}) {

        return this.getSource(photo, {
            ...options,
            profile: "thumbnail"
        });

    }

    getPreview(photo, options = {}) {

        return this.getSource(photo, {
            ...options,
            profile: "preview"
        });

    }

    async getThumbnailResult(photo, options = {}) {

        const cacheKey = getThumbnailCacheKey(photo, "thumbnail");
        const source = await this.getThumbnail(photo, options);
        return {
            status: source ? "READY" : "FAILED",
            cacheKey,
            source
        };

    }

    markLoadState(photo, state, profile = "thumbnail") {

        const key = getThumbnailCacheKey(photo, profile);
        if (key) this.loadStates.set(key, state);

    }

    rejectSource(
        photo,
        profile = "thumbnail",
        source = null,
        errorName = "ImageElementError"
    ) {

        const key = getThumbnailCacheKey(photo, profile);
        const sourceKey = getSourceCacheKey(photo, profile);
        if (!key) return;
        const resolvedKey = this.cacheAliases.get(key) || key;
        const cached = ThumbnailCache.get(resolvedKey);
        const shared = sourceKey !== key
            ? this.getCachedSource(sourceKey)
            : null;
        if (source && cached === source) {
            ThumbnailCache.remove(resolvedKey);
            this.deleteAliasesForTarget(resolvedKey);
        }
        if (source && shared === source) ThumbnailCache.remove(sourceKey);
        const error = new Error("The image element rejected the source.");
        error.name = errorName;
        this.recordFailure(
            photo,
            profile,
            sourceKey,
            error,
            "IMAGE_ELEMENT_REJECTED"
        );

    }

    getLoadState(photo, profile = "thumbnail") {

        const key = getThumbnailCacheKey(photo, profile);
        return key
            ? this.loadStates.get(key) || "idle"
            : "unavailable";

    }

    retainSource(source) {

        ThumbnailCache.retainSource(source);

    }

    releaseSource(source) {

        ThumbnailCache.releaseSource(source);

    }

    restoreCachedThumbnail(photo) {

        const source = this.getCachedThumbnail(photo);
        if (!source) return null;
        photo.setThumbnail?.(source);
        photo.thumbnail = source;
        photo.loaded = true;
        return source;

    }

    hasCachedThumbnails() {

        return ThumbnailCache.size() > 0;

    }

    invalidatePhoto(photo) {

        for (const profile of ["thumbnail", "preview"]) {
            const key = getThumbnailCacheKey(photo, profile);
            if (!key) continue;
            const hadAlias = this.cacheAliases.has(key);
            this.deleteCacheAlias(key);
            if (!hadAlias) ThumbnailCache.remove(key);
            this.failures.delete(key);
            this.loadStates.delete(key);
        }

    }

    recordFailure(
        photo,
        profile,
        sourceKey,
        error,
        reason = generationFailureReason(error)
    ) {

        const failureIdentity =
            anonymizedPhotoIdentity(sourceKey);
        const reportKey =
            `${this.generation}|${profile}|${failureIdentity}`;
        this.failures.add(sourceKey);
        this.loadStates.set(sourceKey, "error");
        if (this.reportedFailures.has(reportKey)) return;

        this.reportedFailures.add(reportKey);
        PhotoBrowserPerformance.recordGenerationOutcome({
            profile,
            success: false,
            failureIdentity
        });
        const configuration = profileConfiguration(profile);
        this.traceBounded(
            configuration.failureEvent,
            `${profile}:failure-diagnostics`,
            {
                photoName: photo?.name || null,
                photoIdentity: failureIdentity,
                profile,
                failureReason: reason,
                errorName: error?.name || "Error"
            }
        );

    }

    async clear({
        preserveCache = false,
        reason = "service-clear",
        workspaceGeneration = this.workspaceGeneration + 1
    } = {}) {

        this.generation++;
        this.workspaceGeneration = Math.max(
            this.workspaceGeneration,
            workspaceGeneration
        );
        this.acceptingRequests = false;
        const pendingRequests = [...this.inFlight.values()];
        for (const lifecycle of this.requestContexts.values()) {
            lifecycle.cancelled = true;
        }
        for (const [key, pending] of this.inFlight) {
            BrowserDecodeScheduler.cancel(key);
            pending.cancel?.();
        }
        this.failures.clear();
        this.reportedFailures.clear();
        this.loadStates.clear();
        this.diagnosticCounts.clear();
        if (!preserveCache) {
            this.cacheAliases.clear();
            this.cacheAliasCounts.clear();
            ThumbnailCache.clear(reason);
        }
        await BrowserDecodeScheduler.whenIdle();
        await Promise.allSettled(pendingRequests);
        this.inFlight.clear();
        this.requestContexts.clear();
        return this.emitRuntimeSummary(reason);

    }

    activateWorkspace(workspaceGeneration) {

        if (workspaceGeneration !== this.workspaceGeneration) return false;
        this.acceptingRequests = true;
        return true;

    }

    getWorkspaceGeneration() {

        return this.workspaceGeneration;

    }

    isWorkspaceGenerationCurrent(workspaceGeneration) {

        return this.acceptingRequests &&
            workspaceGeneration === this.workspaceGeneration;

    }

    createRequestLifecycle({
        profile,
        requestGeneration,
        workspaceGeneration
    }) {

        const lifecycle = {
            profile,
            requestGeneration,
            workspaceGeneration,
            cancelled: false,
            cancellationRecorded: false,
            isCancelled: () =>
                lifecycle.cancelled ||
                requestGeneration !== this.generation ||
                workspaceGeneration !== this.workspaceGeneration ||
                !this.acceptingRequests,
            throwIfCancelled: checkpoint => {
                if (!lifecycle.isCancelled()) return;
                if (!lifecycle.cancellationRecorded) {
                    lifecycle.cancellationRecorded = true;
                    PhotoBrowserPerformance.recordStaleJobRejection(
                        checkpoint
                    );
                }
                const error = new Error(
                    "The image request belongs to a released workspace."
                );
                error.name = "StaleImageRequestError";
                error.checkpoint = checkpoint;
                throw error;
            }
        };
        return lifecycle;

    }

    emitRuntimeSummary(reason = "explicit") {

        return PhotoBrowserPerformance.emitRuntimeSummary({
            reason,
            thumbnailCacheEntries: ThumbnailCache.size(),
            ...BrowserDecodeScheduler.snapshot()
        });

    }

    getCachedSource(key) {

        if (!key) return null;
        const target = this.cacheAliases.get(key);
        if (target) {
            const source = ThumbnailCache.get(target);
            if (source) return source;
            this.deleteCacheAlias(key, false);
        }
        return ThumbnailCache.get(key);

    }

    setCacheAlias(alias, target) {

        const previous = this.cacheAliases.get(alias);
        if (previous === target) return;
        if (previous) this.deleteCacheAlias(alias);
        this.cacheAliases.set(alias, target);
        this.cacheAliasCounts.set(
            target,
            (this.cacheAliasCounts.get(target) || 0) + 1
        );

    }

    deleteCacheAlias(alias, removeUnreferenced = true) {

        const target = this.cacheAliases.get(alias);
        if (!target) return;
        this.cacheAliases.delete(alias);
        const remaining = Math.max(
            0,
            (this.cacheAliasCounts.get(target) || 1) - 1
        );
        if (remaining) {
            this.cacheAliasCounts.set(target, remaining);
            return;
        }
        this.cacheAliasCounts.delete(target);
        if (removeUnreferenced) ThumbnailCache.remove(target);

    }

    deleteAliasesForTarget(target) {

        for (const [alias, candidate] of this.cacheAliases) {
            if (candidate === target) this.cacheAliases.delete(alias);
        }
        this.cacheAliasCounts.delete(target);

    }

    traceBounded(operation, bucket, details) {

        const count = this.diagnosticCounts.get(bucket) || 0;
        if (count >= MAX_DIAGNOSTIC_SAMPLES) return;
        this.diagnosticCounts.set(bucket, count + 1);
        PhotoBrowserPerformance.trace(operation, details);

    }

}

export default new ThumbnailService();
