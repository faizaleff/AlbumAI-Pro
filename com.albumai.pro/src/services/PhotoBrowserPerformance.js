const now = () => (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
        ? performance.now()
        : Date.now()
);

const HIGH_FREQUENCY_TRACES = new Set([
    "BROWSER_IMAGE_COUNT",
    "BROWSER_LAYOUT_RECALCULATED",
    "BROWSER_RENDER_ROWS",
    "BROWSER_RESIZE",
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
    "REFRESH_SUBSCRIBE",
    "REFRESH_UNSUBSCRIBE",
    "THUMB_CACHE_RESTORE_MISS",
    "THUMB_CARD_REMOUNT",
    "THUMB_SOURCE_CLEARED",
    "VISIBLE_CARDS"
]);
const INITIAL_TRACE_SAMPLES = 5;
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
        this.liveImageBuffers = 0;
        this.photoImageMounts = 0;
        this.mountedPhotoImages = 0;
        this.mountedBrowserImages = 0;
        this.mountedPreviewImages = 0;
        this.traceCounts = Object.create(null);
        this.lastVirtualizationLogAt = 0;

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
        this.trace("PHOTOIMAGE_MOUNT", {
            totalMounts: this.photoImageMounts,
            mounted: this.mountedPhotoImages,
            browserMounted: this.mountedBrowserImages,
            role
        });
        this.trace("IMAGE_ELEMENT_COUNT", {
            count: this.mountedPhotoImages
        });
        if (role === "preview") {
            this.trace("PREVIEW_MOUNT", {
                count: this.mountedPreviewImages
            });
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
        this.trace("PHOTOIMAGE_UNMOUNT", {
            mounted: this.mountedPhotoImages,
            browserMounted: this.mountedBrowserImages,
            role
        });
        this.trace("IMAGE_ELEMENT_COUNT", {
            count: this.mountedPhotoImages
        });
        if (role === "preview") {
            this.trace("PREVIEW_UNMOUNT", {
                count: this.mountedPreviewImages
            });
        }

    }

    browserCards(details) {

        this.trace("VISIBLE_CARDS", {
            count: details.visible || 0,
            viewMode: details.viewMode
        });
        this.trace("MOUNTED_CARDS", {
            count: details.mounted || 0,
            viewMode: details.viewMode
        });

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
        this.pendingViewSwitch = null;

    }

    recordSelection(details) {

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

        if (!this.isRenderProfilingEnabled()) return;

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
        if (
            !this.isVerboseDiagnosticsEnabled() &&
            timestamp - this.lastVirtualizationLogAt < 1000
        ) {
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

    refresh() {

        if (this.session) this.session.refreshes++;

    }

    trackObjectUrl(url) {

        if (
            typeof url === "string" &&
            url.startsWith("blob:")
        ) {
            this.objectUrls.add(url);
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
            this.trace("OBJECT_URL_REVOKED", {
                urlId,
                activeUrls: this.objectUrls.size
            });
            URL.revokeObjectURL(url);
            this.trace("OBJECT_URL_REVOKED", {
                urlId,
                activeUrls: this.objectUrls.size - 1
            });
        } catch (error) {
            this.trace("BLOB_URL_REVOKE_ERROR", {
                urlId,
                message: error?.message || String(error)
            });
        }

        this.objectUrls.delete(url);
        this.objectUrlIds.delete(url);
        this.trace("LIVE_BLOBS", { count: this.objectUrls.size });

    }

    getObjectUrlId(url) {

        return this.objectUrlIds.get(url) || null;

    }

    trace(operation, details = {}) {

        this.traceSequence++;
        const operationCount =
            (this.traceCounts[operation] || 0) + 1;
        this.traceCounts[operation] = operationCount;

        if (
            HIGH_FREQUENCY_TRACES.has(operation) &&
            !this.isVerboseDiagnosticsEnabled() &&
            operationCount > INITIAL_TRACE_SAMPLES &&
            operationCount % TRACE_SAMPLE_INTERVAL !== 0
        ) {
            return;
        }

        console.info(
            `[ALB014-CRASH ${this.traceSequence}] ${operation}`,
            JSON.stringify({
                ...details,
                ...(HIGH_FREQUENCY_TRACES.has(operation)
                    ? { sampleCount: operationCount }
                    : {})
            })
        );

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
