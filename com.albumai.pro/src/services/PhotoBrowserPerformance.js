const now = () => (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
        ? performance.now()
        : Date.now()
);

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
            cacheLookupMs: 0
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

    isRenderProfilingEnabled() {

        try {
            return globalThis
                .__ALBUMAI_RENDER_PROFILING__ === true;
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
            this.trace("BLOB_URL_CREATED", {
                urlId: this.objectUrlIds.get(url),
                activeUrls: this.objectUrls.size
            });
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
            this.trace("BLOB_URL_REVOKE_BEFORE", {
                urlId,
                activeUrls: this.objectUrls.size
            });
            URL.revokeObjectURL(url);
            this.trace("BLOB_URL_REVOKE_AFTER", {
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

    }

    getObjectUrlId(url) {

        return this.objectUrlIds.get(url) || null;

    }

    trace(operation, details = {}) {

        this.traceSequence++;
        console.info(
            `[ALB014-CRASH ${this.traceSequence}] ${operation}`,
            JSON.stringify(details)
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
