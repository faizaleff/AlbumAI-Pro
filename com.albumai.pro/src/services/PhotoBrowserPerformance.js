const now = () => (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
        ? performance.now()
        : Date.now()
);

const HIGH_FREQUENCY_TRACES = new Set([
    "ACTIVE_BROWSER_DECODES",
    "LIVE_BLOBS",
    "OBJECT_URL_CREATED",
    "OBJECT_URL_REVOKED",
    "SOFTWARE_JPEG_RENDER_FAILURE",
    "SOFTWARE_JPEG_RENDER_START",
    "SOFTWARE_JPEG_RENDER_SUCCESS",
    "THUMB_CACHE_EVICT",
    "THUMB_CACHE_SIZE"
]);
const QUIET_BY_DEFAULT_TRACES = new Set([
    "BROWSER_FOCUSED_PHOTO",
    "BROWSER_IMAGE_COUNT",
    "BROWSER_KEYBOARD_EVENT",
    "BROWSER_LAYOUT_RECALCULATED",
    "BROWSER_RENDER_ROWS",
    "BROWSER_RESIZE",
    "BROWSER_SELECTION_COUNT",
    "BROWSER_SORT_INPUT",
    "BROWSER_SORT_STATE",
    "BROWSER_SOURCE_COUNT",
    "BROWSER_VIRTUAL_WINDOW",
    "CACHE_KEY",
    "CACHE_MISS",
    "IMAGE_ELEMENT_COUNT",
    "IMG_NODE_ATTACHED",
    "IMG_NODE_DETACHED",
    "IMG_REF_READY",
    "MOUNTED_CARDS",
    "PHOTOIMAGE_MOUNT",
    "PHOTOIMAGE_SOURCE_BLOCKED",
    "PHOTOIMAGE_SOURCE_INPUT",
    "PHOTOIMAGE_SOURCE_NORMALIZED",
    "PHOTOIMAGE_UNMOUNT",
    "PREVIEW_MOUNT",
    "PREVIEW_SOURCE_CHANGED",
    "PREVIEW_SOURCE_RELEASED",
    "PREVIEW_UNMOUNT",
    "REFRESH_SUBSCRIBE",
    "REFRESH_UNSUBSCRIBE",
    "THUMB_CACHE_RESTORE_MISS",
    "THUMB_CARD_REMOUNT",
    "THUMB_SOURCE_CLEARED",
    "THUMB_UNMOUNTED_UPDATE_IGNORED",
    "UI_POLISH_READY",
    "VISIBLE_CARDS"
]);
const INITIAL_TRACE_SAMPLES = 3;
const TRACE_SAMPLE_INTERVAL = 100;

class PhotoBrowserPerformance {

    constructor() {

        this.session = null;
        this.objectUrls = new Set();
        this.objectUrlIds = new Map();
        this.nextSessionId = 1;
        this.nextObjectUrlId = 1;
        this.traceSequence = 0;
        this.renderCounts = Object.create(null);
        this.pendingViewSwitch = null;
        this.documentIds = new Set();
        this.docOpenCount = 0;
        this.docCloseCount = 0;
        this.browserDocumentOpenViolations = 0;
        this.browserDocumentBaselineUnavailableLogged = false;
        this.liveImageBuffers = 0;
        this.photoImageMounts = 0;
        this.mountedPhotoImages = 0;
        this.mountedBrowserImages = 0;
        this.mountedPreviewImages = 0;
        this.traceCounts = Object.create(null);
        this.lastVirtualizationLogAt = 0;
        this.runtimeCounts = {
            thumbnailSuccesses: 0,
            thumbnailFailures: 0,
            previewSuccesses: 0,
            previewFailures: 0,
            objectUrlsCreated: 0,
            objectUrlsRevoked: 0,
            staleJobsRejected: 0,
            cancelledBeforeRead: 0,
            cancelledAfterRead: 0,
            cancelledBeforePublish: 0
        };
        this.uniqueFailureSources = {
            thumbnail: new Set(),
            preview: new Set()
        };

    }

    beginFolderLoad() {

        this.session = {
            id: this.nextSessionId++,
            startedAt: now(),
            pickerCompletedAt: null,
            getEntriesStartedAt: null,
            getEntriesCompletedAt: null,
            filteringStartedAt: null,
            filteringCompletedAt: null,
            metadataStartedAt: null,
            modelCompletedAt: null,
            publishRequestedAt: null,
            publishedAt: null,
            persistentTokenMs: null,
            projectPersistenceMs: null,
            firstThumbnailAt: null,
            firstTenAt: null,
            allThumbnailsAt: null,
            total: 0,
            completed: 0,
            visibleIds: new Set(),
            refreshes: 0,
            activeJobs: 0,
            peakActiveJobs: 0,
            cacheHits: 0,
            cacheMisses: 0,
            cacheSkipped: 0,
            cacheKeyMs: 0,
            cacheLookupMs: 0,
            visibleSourceAssignedMs: null,
            firstBrowserImageVisibleMs: null
        };

    }

    markPickerComplete() {

        if (this.session) {
            this.session.pickerCompletedAt = now();
        }

    }

    markEnumerationStart() {

        if (this.session) {
            this.session.getEntriesStartedAt = now();
        }

    }

    markEnumerationComplete() {

        if (this.session) {
            this.session.getEntriesCompletedAt = now();
        }

    }

    markFilteringStart() {

        if (this.session) {
            this.session.filteringStartedAt = now();
        }

    }

    markFilteringComplete() {

        if (this.session) {
            this.session.filteringCompletedAt = now();
        }

    }

    markMetadataStart() {

        if (this.session) {
            this.session.metadataStartedAt = now();
        }

    }

    markModelsComplete(total) {

        if (!this.session) return;
        this.session.modelCompletedAt = now();
        this.session.total = total;

    }

    markPublishRequested() {

        if (!this.session) return;
        this.session.publishRequestedAt = now();

    }

    markPublished() {

        if (
            !this.session ||
            !this.session.publishRequestedAt ||
            this.session.publishedAt
        ) return;

        this.session.publishedAt = now();
        this.log("metadata", {
            folderPickerMs: this.duration(
                this.session.startedAt,
                this.session.pickerCompletedAt
            ),
            getEntriesMs: this.duration(
                this.session.getEntriesStartedAt,
                this.session.getEntriesCompletedAt
            ),
            extensionFilteringMs: this.duration(
                this.session.filteringStartedAt,
                this.session.filteringCompletedAt
            ),
            perFileMetadataMs: this.duration(
                this.session.metadataStartedAt,
                this.session.modelCompletedAt
            ),
            reactPublishMs: this.duration(
                this.session.publishRequestedAt,
                this.session.publishedAt
            ),
            metadataVisibleMs: this.duration(
                this.session.pickerCompletedAt,
                this.session.publishedAt
            ),
            photos: this.session.total
        });

    }

    thumbnailStarted() {

        if (!this.session) return null;
        this.session.activeJobs++;
        this.session.peakActiveJobs = Math.max(
            this.session.peakActiveJobs,
            this.session.activeJobs
        );

        return this.session.id;

    }

    thumbnailCompleted(sessionId) {

        if (
            !this.session ||
            sessionId !== this.session.id
        ) return;

        this.session.activeJobs = Math.max(
            0,
            this.session.activeJobs - 1
        );
        this.session.completed++;

        if (
            !this.session.allThumbnailsAt &&
            this.session.completed >= this.session.total
        ) {
            this.session.allThumbnailsAt = now();
            this.log("thumbnails", this.snapshot());
        }

    }

    thumbnailVisible(photoId) {

        if (
            !this.session ||
            !photoId ||
            this.session.visibleIds.has(photoId)
        ) return;

        this.session.visibleIds.add(photoId);
        const timestamp = now();

        if (!this.session.firstThumbnailAt) {
            this.session.firstThumbnailAt = timestamp;
            this.log("first-visible", {
                firstThumbnailMs: this.duration(
                    this.session.pickerCompletedAt,
                    timestamp
                )
            });
        }

        if (
            !this.session.firstTenAt &&
            this.session.visibleIds.size >=
                Math.min(10, this.session.total)
        ) {
            this.session.firstTenAt = timestamp;
            this.log("first-10-visible", {
                firstTenThumbnailsMs: this.duration(
                    this.session.pickerCompletedAt,
                    timestamp
                )
            });
        }

    }

    visibleSourceAssigned(photoId, durationMs) {

        if (!this.session || !photoId) return;
        if (this.session.visibleSourceAssignedMs == null) {
            this.session.visibleSourceAssignedMs =
                Math.round(durationMs * 10) / 10;
            this.log("visible-source", {
                visibleSourceAssignedMs:
                    this.session.visibleSourceAssignedMs
            });
        }

    }

    browserImageVisible(photoId, durationMs) {

        if (!this.session || !photoId) return;
        if (this.session.firstBrowserImageVisibleMs == null) {
            this.session.firstBrowserImageVisibleMs =
                Math.round(durationMs * 10) / 10;
            this.log("first-browser-image", {
                firstBrowserImageVisibleMs:
                    this.session.firstBrowserImageVisibleMs
            });
        }

    }

    cacheHit() {

        if (this.session) this.session.cacheHits++;

    }

    cacheMiss() {

        if (this.session) this.session.cacheMisses++;

    }

    cacheSkipped() {

        if (this.session) this.session.cacheSkipped++;

    }

    recordCacheKey(durationMs) {

        if (this.session) {
            this.session.cacheKeyMs += durationMs;
        }

    }

    recordCacheLookup(durationMs) {

        if (this.session) {
            this.session.cacheLookupMs += durationMs;
        }

    }

    recordPersistence({
        persistentTokenMs,
        projectPersistenceMs
    }) {

        if (!this.session) return;

        this.session.persistentTokenMs = persistentTokenMs;
        this.session.projectPersistenceMs =
            projectPersistenceMs;
        this.log("persistence", {
            persistentTokenMs,
            projectPersistenceMs
        });

    }

    timestamp() {

        return now();

    }

    documentOpened(documentId) {

        this.docOpenCount++;
        if (documentId != null) this.documentIds.add(documentId);
        this.trace("DOC_OPEN_COUNT", {
            count: this.docOpenCount,
            live: this.documentIds.size
        });
        this.trace("LIVE_DOC_REFS", { count: this.documentIds.size });

    }

    documentClosed(documentId) {

        this.docCloseCount++;
        if (documentId != null) this.documentIds.delete(documentId);
        this.trace("DOC_CLOSE_COUNT", {
            count: this.docCloseCount,
            live: this.documentIds.size
        });
        this.trace("LIVE_DOC_REFS", { count: this.documentIds.size });

    }

    beginBrowserDocumentInvariant() {

        return {
            openCount: this.docOpenCount,
            liveReferences: this.documentIds.size
        };

    }

    verifyBrowserDocumentInvariant(baseline, role) {

        if (
            typeof process !== "undefined" &&
            process.env?.NODE_ENV === "production"
        ) return;

        const beforeOpenCount = baseline?.openCount;
        const afterOpenCount = this.docOpenCount;
        const beforeLiveReferences = baseline?.liveReferences;
        const liveReferences = this.documentIds.size;
        const canCompareOpenCount =
            Number.isFinite(beforeOpenCount) &&
            Number.isFinite(afterOpenCount);
        const canCompareLiveReferences =
            Number.isFinite(beforeLiveReferences) &&
            Number.isFinite(liveReferences);

        if (
            (!canCompareOpenCount || !canCompareLiveReferences) &&
            !this.browserDocumentBaselineUnavailableLogged
        ) {
            this.browserDocumentBaselineUnavailableLogged = true;
            console.info(
                "BROWSER_DOCUMENT_INVARIANT_BASELINE_UNAVAILABLE",
                {
                    role,
                    openCountComparable: canCompareOpenCount,
                    liveReferencesComparable:
                        canCompareLiveReferences,
                    afterOpenCount:
                        Number.isFinite(afterOpenCount)
                            ? afterOpenCount
                            : null,
                    liveReferences:
                        Number.isFinite(liveReferences)
                            ? liveReferences
                            : null
                }
            );
        }

        const openCountDelta = canCompareOpenCount
            ? afterOpenCount - beforeOpenCount
            : 0;
        const liveReferenceDelta = canCompareLiveReferences
            ? liveReferences - beforeLiveReferences
            : 0;
        if (openCountDelta <= 0 && liveReferenceDelta <= 0) return;

        this.browserDocumentOpenViolations += Math.max(
            openCountDelta,
            liveReferenceDelta
        );

        console.error("BROWSER_DOCUMENT_INVARIANT_FAILED", {
            role,
            beforeOpenCount:
                canCompareOpenCount ? beforeOpenCount : null,
            afterOpenCount:
                Number.isFinite(afterOpenCount)
                    ? afterOpenCount
                    : null,
            openCountDelta,
            beforeLiveReferences:
                canCompareLiveReferences
                    ? beforeLiveReferences
                    : null,
            liveReferences:
                Number.isFinite(liveReferences)
                    ? liveReferences
                    : null,
            liveReferenceDelta
        });

    }

    imageBufferAcquired() {

        this.liveImageBuffers++;
        this.trace("LIVE_IMAGE_BUFFERS", { count: this.liveImageBuffers });
        this.trace("LIVE_ARRAYBUFFERS", { count: this.liveImageBuffers });

    }

    imageBufferReleased() {

        this.liveImageBuffers = Math.max(0, this.liveImageBuffers - 1);
        this.trace("LIVE_IMAGE_BUFFERS", { count: this.liveImageBuffers });
        this.trace("LIVE_ARRAYBUFFERS", { count: this.liveImageBuffers });

    }

    photoImageMounted(role = "browser") {

        this.photoImageMounts++;
        this.mountedPhotoImages++;
        if (role === "preview") {
            this.mountedPreviewImages++;
        } else if (role === "browser") {
            this.mountedBrowserImages++;
        }

    }

    photoImageUnmounted(role = "browser") {

        this.mountedPhotoImages = Math.max(0, this.mountedPhotoImages - 1);
        if (role === "preview") {
            this.mountedPreviewImages = Math.max(
                0,
                this.mountedPreviewImages - 1
            );
        } else if (role === "browser") {
            this.mountedBrowserImages = Math.max(
                0,
                this.mountedBrowserImages - 1
            );
        }

    }

    browserCards(details) {

        this.visibleBrowserCards = details.visible || 0;
        this.mountedBrowserCards = details.mounted || 0;

    }

    recordRender(component) {

        if (!this.isRenderProfilingEnabled()) return;

        const count =
            (this.renderCounts[component] || 0) + 1;
        this.renderCounts[component] = count;

        if (count === 1 || count % 25 === 0) {
            console.info(
                "[PhotoBrowser:render]",
                JSON.stringify({ component, count })
            );
        }

    }

    beginViewSwitch(from, to) {

        this.pendingViewSwitch = {
            from,
            to,
            startedAt: now()
        };

    }

    completeViewSwitch(view) {

        const pending = this.pendingViewSwitch;

        if (!pending || pending.to !== view) return;
        if (this.isDevelopment()) {
            console.info(
                "[PhotoBrowser:view-switch]",
                JSON.stringify({
                    from: pending.from,
                    to: pending.to,
                    durationMs: this.duration(
                        pending.startedAt,
                        now()
                    )
                })
            );
        }
        this.pendingViewSwitch = null;

    }

    recordSelection(details) {

        if (
            !this.isDevelopment() ||
            !this.isVerboseDiagnosticsEnabled()
        ) return;
        console.info(
            "[PhotoBrowser:selection]",
            JSON.stringify({
                ...details,
                durationMs:
                    Math.round(details.durationMs * 10) / 10
            })
        );

    }

    getRenderCounts() {

        return { ...this.renderCounts };

    }

    recordRenderUpdate(component, update, details = {}) {

        if (
            !this.isDevelopment() ||
            !this.isRenderProfilingEnabled()
        ) return;

        console.info(
            "[PhotoBrowser:update]",
            JSON.stringify({
                component,
                update,
                ...details
            })
        );

    }

    recordVirtualization(details) {

        if (
            !this.isDevelopment() ||
            !this.isVerboseDiagnosticsEnabled()
        ) return;
        const values = {
            visibleItems: details.visibleItems || 0,
            renderedItems: details.renderedItems || 0,
            overscanItems: details.overscanItems || 0,
            scrollRenderMs: details.scrollRenderMs == null
                ? null
                : Math.round(details.scrollRenderMs * 10) / 10,
            initialRenderMs: details.initialRenderMs == null
                ? null
                : Math.round(details.initialRenderMs * 10) / 10,
            viewMode: details.viewMode
        };

        const timestamp = now();
        if (timestamp - this.lastVirtualizationLogAt < 1000) {
            return;
        }
        this.lastVirtualizationLogAt = timestamp;

        console.info(
            "[PhotoBrowser:virtualization]",
            JSON.stringify(values)
        );

    }

    isRenderProfilingEnabled() {

        try {
            return globalThis
                .__ALBUMAI_RENDER_PROFILING__ === true;
        } catch (_) {
            return false;
        }

    }

    isVerboseDiagnosticsEnabled() {

        try {
            return globalThis
                .__ALBUMAI_VERBOSE_BROWSER_DIAGNOSTICS__ === true;
        } catch (_) {
            return false;
        }

    }

    isDevelopment() {

        return typeof process === "undefined" ||
            process.env?.NODE_ENV !== "production";

    }

    refresh() {

        if (this.session) this.session.refreshes++;

    }

    trackObjectUrl(url) {

        if (
            typeof url === "string" &&
            url.startsWith("blob:")
        ) {
            if (this.objectUrls.has(url)) return url;
            this.objectUrls.add(url);
            this.runtimeCounts.objectUrlsCreated++;
            this.objectUrlIds.set(
                url,
                this.nextObjectUrlId++
            );
            this.trace("OBJECT_URL_CREATED", {
                urlId: this.objectUrlIds.get(url),
                activeUrls: this.objectUrls.size
            });
            this.trace("LIVE_BLOBS", { count: this.objectUrls.size });
        }

        return url;

    }

    releaseObjectUrl(url) {

        const urlId = this.objectUrlIds.get(url) || null;

        if (!this.objectUrls.has(url)) {
            this.trace("BLOB_URL_REVOKE_SKIPPED", {
                urlId,
                reason: "not-tracked"
            });
            return;
        }

        try {
            URL.revokeObjectURL(url);
        } catch (error) {
            this.trace("BLOB_URL_REVOKE_ERROR", {
                urlId,
                message: error?.message || String(error)
            });
            return;
        }

        this.objectUrls.delete(url);
        this.objectUrlIds.delete(url);
        this.runtimeCounts.objectUrlsRevoked++;
        this.trace("OBJECT_URL_REVOKED", {
            urlId,
            activeUrls: this.objectUrls.size
        });
        this.trace("LIVE_BLOBS", { count: this.objectUrls.size });

    }

    getObjectUrlId(url) {

        return this.objectUrlIds.get(url) || null;

    }

    recordGenerationOutcome({
        profile,
        success,
        failureIdentity = null
    }) {

        const normalizedProfile =
            profile === "preview" ? "preview" : "thumbnail";
        const counter = success
            ? `${normalizedProfile}Successes`
            : `${normalizedProfile}Failures`;
        this.runtimeCounts[counter]++;
        if (!success && failureIdentity) {
            this.uniqueFailureSources[normalizedProfile].add(
                failureIdentity
            );
        }

    }

    recordStaleJobRejection(checkpoint) {

        this.runtimeCounts.staleJobsRejected++;
        if (checkpoint === "before-read") {
            this.runtimeCounts.cancelledBeforeRead++;
        } else if (
            checkpoint === "before-cache-publication" ||
            checkpoint === "before-component-publication"
        ) {
            this.runtimeCounts.cancelledBeforePublish++;
        } else {
            this.runtimeCounts.cancelledAfterRead++;
        }

    }

    trace(operation, details = {}) {

        const operationCount =
            (this.traceCounts[operation] || 0) + 1;
        this.traceCounts[operation] = operationCount;
        if (!this.isDevelopment()) return;
        if (
            QUIET_BY_DEFAULT_TRACES.has(operation) &&
            !this.isVerboseDiagnosticsEnabled()
        ) return;
        this.traceSequence++;

        if (
            HIGH_FREQUENCY_TRACES.has(operation) &&
            !this.isVerboseDiagnosticsEnabled() &&
            operationCount > INITIAL_TRACE_SAMPLES &&
            operationCount % TRACE_SAMPLE_INTERVAL !== 0
        ) {
            return;
        }

        console.info(
            `[AlbumAI:browser ${this.traceSequence}] ${operation}`,
            JSON.stringify({
                ...details,
                ...(HIGH_FREQUENCY_TRACES.has(operation)
                    ? { sampleCount: operationCount }
                    : {})
            })
        );

    }

    emitRuntimeSummary({
        reason = "explicit",
        thumbnailCacheEntries = 0,
        activeBrowserDecodes = 0,
        activePreviewDecodes = 0,
        pendingJobs = 0
    } = {}) {

        const summary = {
            thumbnailCacheEntries,
            activeObjectUrls: this.objectUrls.size,
            liveBlobs: this.objectUrls.size,
            activeBrowserDecodes,
            activePreviewDecodes,
            pendingJobs,
            photoshopDocumentsOpenedByBrowser:
                this.browserDocumentOpenViolations,
            ...this.runtimeCounts,
            uniqueThumbnailFailureSources:
                this.uniqueFailureSources.thumbnail.size,
            uniquePreviewFailureSources:
                this.uniqueFailureSources.preview.size
        };
        if (this.isDevelopment()) {
            console.info(
                "ALB_042_RUNTIME_SUMMARY",
                JSON.stringify({ reason, ...summary })
            );
        }
        return summary;

    }

    snapshot() {

        const session = this.session;

        if (!session) {
            return {
                objectUrls: this.objectUrls.size
            };
        }

        return {
            folderPickerMs: this.duration(
                session.startedAt,
                session.pickerCompletedAt
            ),
            enumerationMs: this.duration(
                session.getEntriesStartedAt,
                session.getEntriesCompletedAt
            ),
            getEntriesMs: this.duration(
                session.getEntriesStartedAt,
                session.getEntriesCompletedAt
            ),
            extensionFilteringMs: this.duration(
                session.filteringStartedAt,
                session.filteringCompletedAt
            ),
            perFileMetadataMs: this.duration(
                session.metadataStartedAt,
                session.modelCompletedAt
            ),
            cacheKeyMs:
                Math.round(session.cacheKeyMs * 10) / 10,
            cacheLookupMs:
                Math.round(session.cacheLookupMs * 10) / 10,
            visibleSourceAssignedMs:
                session.visibleSourceAssignedMs,
            firstBrowserImageVisibleMs:
                session.firstBrowserImageVisibleMs,
            persistentTokenMs: session.persistentTokenMs,
            projectPersistenceMs:
                session.projectPersistenceMs,
            reactPublishMs: this.duration(
                session.publishRequestedAt,
                session.publishedAt
            ),
            metadataVisibleMs: this.duration(
                session.pickerCompletedAt,
                session.publishedAt
            ),
            firstThumbnailMs: this.duration(
                session.pickerCompletedAt,
                session.firstThumbnailAt
            ),
            firstTenThumbnailsMs: this.duration(
                session.pickerCompletedAt,
                session.firstTenAt
            ),
            allThumbnailsMs: this.duration(
                session.pickerCompletedAt,
                session.allThumbnailsAt
            ),
            refreshes: session.refreshes,
            activeJobs: session.activeJobs,
            peakActiveJobs: session.peakActiveJobs,
            cacheHits: session.cacheHits,
            cacheMisses: session.cacheMisses,
            cacheSkipped: session.cacheSkipped,
            objectUrls: this.objectUrls.size
        };

    }

    duration(start, end) {

        if (start == null || end == null) return null;
        return Math.round((end - start) * 10) / 10;

    }

    log(stage, values) {

        console.info(
            `[PhotoBrowser:${stage}]`,
            JSON.stringify(values)
        );

    }

}

export default new PhotoBrowserPerformance();
