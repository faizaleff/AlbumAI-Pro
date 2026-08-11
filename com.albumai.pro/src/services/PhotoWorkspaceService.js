import { storage } from "uxp";

import { importPhotoFolder } from "./FolderService";
import ThumbnailService from "./ThumbnailService";
import RefreshService from "./RefreshService";
import ThumbnailQueue, {
    ThumbnailPriority
} from "../queue/ThumbnailQueue";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";
import { logPhotoRuntimeSchemaOnce } from "./PhotoFileEntry";
import {
    normalizePhotoDecisions,
    reconcilePhotoDecisions,
    updatePhotoDecision
} from "./PhotoBrowserModel";

const METADATA_FILE = "photos.json";
const INITIAL_VISIBLE_PHOTOS = 30;
const INITIAL_OVERSCAN_PHOTOS = 30;

export const PhotoFolderChangeStatus = Object.freeze({
    PREPARED: "PREPARED",
    SUCCESS: "SUCCESS",
    CANCELLED: "CANCELLED",
    SAME_FOLDER: "SAME_FOLDER",
    EMPTY_FOLDER: "EMPTY_FOLDER",
    UNSUPPORTED_ONLY: "UNSUPPORTED_ONLY",
    INACCESSIBLE: "INACCESSIBLE",
    TOKEN_FAILURE: "TOKEN_FAILURE",
    SAVE_FAILURE: "SAVE_FAILURE",
    SUPERSEDED: "SUPERSEDED",
    INVALID_TRANSACTION: "INVALID_TRANSACTION",
    COMMIT_FAILURE: "COMMIT_FAILURE",
    RECOVERY_DECISION_REQUIRED: "RECOVERY_DECISION_REQUIRED",
    BLOCKED_ACTIVE_BATCH: "BLOCKED_ACTIVE_BATCH"
});

function folderChangeResult(status, values = {}) {

    return Object.freeze({
        status,
        ...values
    });

}

function revisionValue(value) {

    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (!value) return 0;
    return new Date(value).getTime() || 0;

}

function sameSourceRevision(previous, next) {

    return Number(previous?.fileSize || previous?.file?.size || 0) ===
            Number(next?.fileSize || next?.file?.size || 0) &&
        revisionValue(previous?.modified || previous?.file?.modified) ===
            revisionValue(next?.modified || next?.file?.modified);

}

export default class PhotoWorkspaceService {

    constructor({
        library,
        selection,
        projectEngine,
        projectService,
        localFileSystem = storage.localFileSystem,
        importFolder = importPhotoFolder,
        thumbnailService = ThumbnailService,
        thumbnailQueue = ThumbnailQueue,
        refreshService = RefreshService,
        performance = PhotoBrowserPerformance
    } = {}) {

        if (!library || !selection || !projectEngine || !projectService) {
            throw new Error(
                "Photo workspace dependencies are required."
            );
        }

        this.library = library;
        this.selection = selection;
        this.projectEngine = projectEngine;
        this.projectService = projectService;
        this.localFileSystem = localFileSystem;
        this.importFolder = importFolder;
        this.thumbnailService = thumbnailService;
        this.thumbnailQueue = thumbnailQueue;
        this.refreshService = refreshService;
        this.performance = performance;
        this.sourceFolder = null;
        this.persistencePromise = Promise.resolve();
        this.lifecycleGeneration = 0;
        this.importRequestId = 0;
        this.folderChangeTransactionId = 0;
        this.folderChangeCommitPromise = Promise.resolve();
        this.photoDecisionProjectId = null;
        this.photoDecisions = normalizePhotoDecisions();
        this.photoDecisionsPersisted = this.photoDecisions;

    }

    async importPhotos(folder = null, {
        persistFolderReference = true,
        folderChangeTransactionId = null
    } = {}) {

        this.requireProject();
        if (folderChangeTransactionId === null) {
            this.folderChangeTransactionId++;
        }
        const requestId = ++this.importRequestId;
        const persistenceReason = folder
            ? "PHOTO_FOLDER_REFRESH"
            : "PHOTO_FOLDER_IMPORT";

        this.performance.beginFolderLoad();

        const sourceFolder = folder ||
            await this.localFileSystem.getFolder();

        this.performance.markPickerComplete();

        if (
            !sourceFolder ||
            requestId !== this.importRequestId ||
            !this.isCurrentFolderChange(folderChangeTransactionId)
        ) {
            return null;
        }

        const result = await this.importFolder(sourceFolder);

        if (
            !result ||
            requestId !== this.importRequestId ||
            !this.isCurrentFolderChange(folderChangeTransactionId)
        ) {
            if (result) {
                this.performance.trace(
                    "STALE_FOLDER_IMPORT_IGNORED",
                    { requestId }
                );
            }
            return null;
        }

        const sameFolder = this.sameFolder(
            this.sourceFolder,
            result.folder
        );
        const published = await this.publishImportedFolder(
            result,
            {
                sameFolder,
                requestId,
                folderChangeTransactionId
            }
        );
        if (!published) return null;

        // Project metadata writes are not part of the folder-open critical
        // path. Keep them ordered and report failures without blocking paint.
        this.persistencePromise = this.persistencePromise
            .catch(() => {})
            .then(async () => {
                const persistenceStarted =
                    this.performance.timestamp();
                let persistentTokenMs = 0;
                if (persistFolderReference) {
                    ({ persistentTokenMs } =
                        await this.persistProjectState(
                            persistenceReason
                        ));
                }
                await this.writeMetadataCache();
                const persistenceCompleted =
                    this.performance.timestamp();
                this.performance.recordPersistence({
                    persistentTokenMs,
                    projectPersistenceMs:
                        Math.round(
                            (
                                persistenceCompleted -
                                persistenceStarted
                            ) * 10
                        ) / 10
                });
            })
            .catch(error => {
                console.error(
                    "Photo metadata persistence:",
                    error
                );
            });

        return this.library.getPhotos();

    }

    async publishImportedFolder(
        result,
        {
            sameFolder = false,
            requestId = this.importRequestId,
            folderChangeTransactionId = null
        } = {}
    ) {

        const previousPhotos = this.library.getPhotos();
        const previousById = new Map(
            previousPhotos.map(photo => [photo?.id, photo])
        );
        const nextIds = new Set(
            result.images.map(photo => photo?.id).filter(Boolean)
        );
        const images = sameFolder
            ? result.images.map(photo => {
                const previous = previousById.get(photo.id);
                if (!previous) return photo;
                if (sameSourceRevision(previous, photo)) return previous;
                this.thumbnailService.invalidatePhoto(previous);
                return photo;
            })
            : result.images;
        if (sameFolder) {
            for (const previous of previousPhotos) {
                if (!nextIds.has(previous?.id)) {
                    this.thumbnailService.invalidatePhoto(previous);
                }
            }
        }
        const reused = sameFolder
            ? images.filter(photo => previousById.get(photo.id) === photo).length
            : 0;

        this.lifecycleGeneration++;
        this.performance.trace(
            "FOLDER_SWITCH",
            {
                generation: this.lifecycleGeneration,
                previousFolder:
                    this.sourceFolder?.name || null,
                nextFolder: result.folder?.name || null,
                sameFolder
            }
        );
        this.thumbnailQueue.clear({
            discardResults: !sameFolder,
            workspaceGeneration: this.lifecycleGeneration
        });
        await this.thumbnailService.clear({
            preserveCache: sameFolder,
            reason: sameFolder
                ? "same-folder-refresh"
                : "folder-switch",
            workspaceGeneration: this.lifecycleGeneration
        });
        if (
            requestId !== this.importRequestId ||
            !this.isCurrentFolderChange(folderChangeTransactionId)
        ) {
            this.reactivateCurrentPhotoWorkspace();
            return false;
        }
        this.reconcilePhotoDecisionCache(images);
        this.sourceFolder = result.folder;
        if (!sameFolder) this.selection.clear();
        // Placeholder mode is the normal browser fallback. Cache hydration is
        // only useful when this bounded session cache already has entries;
        // never start work for uncached originals here.
        if (this.thumbnailService.hasCachedThumbnails()) {
            for (const photo of images) {
                this.thumbnailService.restoreCachedThumbnail(photo);
            }
        }
        this.library.load(images);
        this.selection.retainAvailable(images);
        this.thumbnailService.activateWorkspace(
            this.lifecycleGeneration
        );
        this.thumbnailQueue.activateGeneration(
            this.lifecycleGeneration
        );
        logPhotoRuntimeSchemaOnce(images[0]);
        this.performance.trace(
            sameFolder
                ? "SAME_FOLDER_REFRESH_REUSED"
                : "SAME_FOLDER_REFRESH_REMOUNTED",
            {
                reused,
                remounted: images.length - reused,
                total: images.length
            }
        );

        // Publish stable photo models before any image decoding starts.
        this.performance.markPublishRequested();
        this.refreshService.refresh();

        const visible = images.slice(
            0,
            INITIAL_VISIBLE_PHOTOS
        );
        const overscan = images.slice(
            INITIAL_VISIBLE_PHOTOS,
            INITIAL_VISIBLE_PHOTOS + INITIAL_OVERSCAN_PHOTOS
        );
        this.thumbnailQueue.addBatch(
            visible,
            ThumbnailPriority.VISIBLE
        );
        this.thumbnailQueue.addBatch(
            overscan,
            ThumbnailPriority.OVERSCAN
        );

        return true;

    }

    async preparePhotoFolderChange(folder = null) {

        this.requireProject();
        const transactionId = ++this.folderChangeTransactionId;
        this.traceFolderChange(
            "PHOTO_FOLDER_CHANGE_PREPARE_START",
            { transactionId, pickerRequired: !folder }
        );

        let candidate = folder;
        if (!candidate) {
            try {
                candidate = await this.localFileSystem.getFolder();
            } catch (error) {
                return this.folderChangeFailure(
                    transactionId,
                    PhotoFolderChangeStatus.INACCESSIBLE,
                    error
                );
            }
        }

        if (!this.isCurrentFolderChange(transactionId)) {
            return this.supersededFolderChange(transactionId);
        }
        if (!candidate) {
            return folderChangeResult(
                PhotoFolderChangeStatus.CANCELLED,
                { transactionId }
            );
        }

        let staged;
        try {
            staged = await this.importFolder(candidate);
        } catch (error) {
            return this.folderChangeFailure(
                transactionId,
                PhotoFolderChangeStatus.INACCESSIBLE,
                error
            );
        }

        if (!this.isCurrentFolderChange(transactionId)) {
            return this.supersededFolderChange(transactionId);
        }

        const statistics = staged?.statistics || {};
        const totalFiles = Number(statistics.totalFiles) || 0;
        const recognizedImages =
            Number(statistics.recognizedImages) || 0;
        const browserRenderableImages =
            Number(statistics.browserRenderableImages) || 0;
        const counts = Object.freeze({
            totalFiles,
            recognizedImages,
            browserRenderableImages,
            unsupportedRecognizedImages:
                Number(statistics.unsupportedRecognizedImages) || 0
        });

        if (totalFiles === 0) {
            return folderChangeResult(
                PhotoFolderChangeStatus.EMPTY_FOLDER,
                { transactionId, counts }
            );
        }
        if (browserRenderableImages === 0) {
            return folderChangeResult(
                PhotoFolderChangeStatus.UNSUPPORTED_ONLY,
                { transactionId, counts }
            );
        }

        const sameFolder = this.sameFolder(
            this.sourceFolder,
            candidate
        );
        if (sameFolder) {
            this.traceFolderChange(
                "PHOTO_FOLDER_CHANGE_SAME_FOLDER",
                { transactionId, counts }
            );
            return folderChangeResult(
                PhotoFolderChangeStatus.SAME_FOLDER,
                {
                    transactionId,
                    folder: candidate,
                    folderName: candidate.name || null,
                    images: staged.images,
                    counts
                }
            );
        }

        this.traceFolderChange(
            "PHOTO_FOLDER_CHANGE_PREPARED",
            { transactionId, counts }
        );
        return folderChangeResult(
            PhotoFolderChangeStatus.PREPARED,
            {
                transactionId,
                folder: candidate,
                folderName: candidate.name || null,
                images: staged.images,
                counts
            }
        );

    }

    commitPreparedPhotoFolderChange(prepared, {
        projectValues = null,
        persistenceReason = "PHOTO_FOLDER_CHANGE"
    } = {}) {

        const operation = this.folderChangeCommitPromise
            .catch(() => {})
            .then(() => this.performPhotoFolderChangeCommit(
                prepared,
                { projectValues, persistenceReason }
            ));
        this.folderChangeCommitPromise = operation;
        return operation;

    }

    async performPhotoFolderChangeCommit(
        prepared,
        { projectValues, persistenceReason }
    ) {

        this.requireProject();
        const transactionId = prepared?.transactionId;
        if (
            !transactionId ||
            !this.isCurrentFolderChange(transactionId)
        ) {
            return this.supersededFolderChange(transactionId);
        }

        if (prepared.status === PhotoFolderChangeStatus.SAME_FOLDER) {
            const photos = await this.importPhotos(
                prepared.folder,
                {
                    persistFolderReference: false,
                    folderChangeTransactionId: transactionId
                }
            );
            if (!this.isCurrentFolderChange(transactionId)) {
                return this.supersededFolderChange(transactionId);
            }
            return folderChangeResult(
                PhotoFolderChangeStatus.SAME_FOLDER,
                {
                    transactionId,
                    photos: photos || this.library.getPhotos()
                }
            );
        }

        if (
            prepared.status !== PhotoFolderChangeStatus.PREPARED ||
            !projectValues ||
            !prepared.folder ||
            !Array.isArray(prepared.images)
        ) {
            return folderChangeResult(
                PhotoFolderChangeStatus.INVALID_TRANSACTION,
                { transactionId: transactionId || null }
            );
        }

        await this.persistencePromise.catch(() => {});
        if (!this.isCurrentFolderChange(transactionId)) {
            return this.supersededFolderChange(transactionId);
        }

        let token;
        try {
            token = await this.createRequiredFolderToken(
                prepared.folder
            );
        } catch (error) {
            return this.folderChangeFailure(
                transactionId,
                PhotoFolderChangeStatus.TOKEN_FAILURE,
                error,
                prepared.counts
            );
        }
        if (!this.isCurrentFolderChange(transactionId)) {
            return this.supersededFolderChange(transactionId);
        }

        const previousMetadata = {
            ...this.projectEngine.getProject()?.metadata
        };
        const nextValues = {
            ...projectValues,
            photoCount: prepared.images.length,
            photoDecisions: reconcilePhotoDecisions(
                this.getPhotoDecisions(),
                prepared.images
            ),
            photoSource: {
                name: prepared.folderName,
                token
            }
        };

        try {
            await this.projectService.saveProject(
                nextValues,
                { reason: persistenceReason }
            );
            this.photoDecisions = nextValues.photoDecisions;
            this.photoDecisionsPersisted = nextValues.photoDecisions;
        } catch (error) {
            this.projectEngine.updateMetadata(previousMetadata);
            return this.folderChangeFailure(
                transactionId,
                PhotoFolderChangeStatus.SAVE_FAILURE,
                error,
                prepared.counts
            );
        }

        if (!this.isCurrentFolderChange(transactionId)) {
            await this.rollbackPersistedFolderChange(
                previousMetadata,
                transactionId
            );
            return this.supersededFolderChange(transactionId);
        }

        const requestId = ++this.importRequestId;
        let published;
        try {
            published = await this.publishImportedFolder(
                {
                    folder: prepared.folder,
                    images: prepared.images
                },
                {
                    sameFolder: false,
                    requestId,
                    folderChangeTransactionId: transactionId
                }
            );
        } catch (error) {
            await this.rollbackPersistedFolderChange(
                previousMetadata,
                transactionId
            );
            return this.folderChangeFailure(
                transactionId,
                PhotoFolderChangeStatus.COMMIT_FAILURE,
                error,
                prepared.counts
            );
        }

        if (!published) {
            await this.rollbackPersistedFolderChange(
                previousMetadata,
                transactionId
            );
            return this.supersededFolderChange(transactionId);
        }

        let metadataCachePersisted = true;
        try {
            await this.writeMetadataCache(prepared.images);
        } catch (error) {
            metadataCachePersisted = false;
            this.traceFolderChange(
                "PHOTO_FOLDER_CHANGE_METADATA_CACHE_FAILURE",
                {
                    transactionId,
                    errorName: error?.name || "Error"
                }
            );
        }

        this.traceFolderChange(
            "PHOTO_FOLDER_CHANGE_COMMITTED",
            {
                transactionId,
                photoCount: prepared.images.length,
                metadataCachePersisted
            }
        );
        return folderChangeResult(
            PhotoFolderChangeStatus.SUCCESS,
            {
                transactionId,
                photoCount: prepared.images.length,
                metadataCachePersisted
            }
        );

    }

    async refreshPhotos() {

        this.requireProject();

        const folder = this.sourceFolder ||
            await this.resolveSourceFolder();

        if (!folder) {
            throw new Error(
                "Import a photo folder before refreshing photos."
            );
        }

        return this.importPhotos(folder);

    }

    async getPhotoFolderStatus() {

        const photoSource =
            this.projectEngine.getProject()?.metadata?.photoSource;
        const hadFolderReference = !!photoSource;

        if (this.sourceFolder) {
            return {
                available: true,
                hadFolderReference
            };
        }

        const folder = await this.resolveSourceFolder();

        if (folder) {
            this.sourceFolder = folder;
            return {
                available: true,
                hadFolderReference
            };
        }

        return {
            available: false,
            hadFolderReference
        };

    }

    markPhotoFolderUnavailable() {

        this.sourceFolder = null;

    }

    async removePhotos() {

        this.requireProject();
        this.folderChangeTransactionId++;
        this.importRequestId++;

        this.lifecycleGeneration++;
        this.performance.trace(
            "PHOTO_WORKSPACE_REMOVE",
            {
                generation: this.lifecycleGeneration,
                photos: this.library.getPhotos().length
            }
        );
        this.thumbnailQueue.clear({
            workspaceGeneration: this.lifecycleGeneration
        });
        await this.thumbnailService.clear({
            reason: "photo-folder-remove",
            workspaceGeneration: this.lifecycleGeneration
        });
        this.selection.clear();
        this.library.load([]);
        this.sourceFolder = null;
        this.photoDecisions = normalizePhotoDecisions();

        await this.projectService.saveProject({
            photoCount: 0,
            photoSource: null,
            photoDecisions: this.photoDecisions
        }, { reason: "PHOTO_FOLDER_REMOVE" });
        this.photoDecisionsPersisted = this.photoDecisions;
        await this.writeMetadataCache();

        this.refreshService.refresh();

    }

    getPhotos() {

        return this.library.getPhotos();

    }

    waitForPersistence() {

        return this.persistencePromise;

    }

    getPhotoDecisions() {

        const project = this.projectEngine.getProject();
        const projectId = project?.metadata?.id || null;
        if (projectId !== this.photoDecisionProjectId) {
            this.photoDecisionProjectId = projectId;
            this.photoDecisions = normalizePhotoDecisions(
                project?.metadata?.photoDecisions
            );
            this.photoDecisionsPersisted = this.photoDecisions;
        }
        return this.photoDecisions;

    }

    updatePhotoDecision(photo, values = {}) {

        this.requireProject();
        const projectId =
            this.projectEngine.getProject()?.metadata?.id || null;
        const previous = this.getPhotoDecisions();
        const next = reconcilePhotoDecisions(
            updatePhotoDecision(previous, photo, values),
            this.library.getPhotos()
        );
        if (JSON.stringify(previous) === JSON.stringify(next)) {
            return Promise.resolve(next);
        }
        this.photoDecisions = next;
        const operation = this.persistencePromise
            .catch(() => {})
            .then(async () => {
                const activeProjectId =
                    this.projectEngine.getProject()?.metadata?.id || null;
                if (activeProjectId !== projectId) {
                    const error = new Error(
                        "Photo decision project changed before persistence."
                    );
                    error.code = "PHOTO_DECISION_PROJECT_CHANGED";
                    throw error;
                }
                await this.projectService.saveProject(
                    { photoDecisions: next },
                    { reason: "PHOTO_DECISION_UPDATE" }
                );
                if (this.photoDecisionProjectId === projectId) {
                    this.photoDecisionsPersisted = next;
                }
                return next;
            })
            .catch(error => {
                if (
                    this.photoDecisionProjectId === projectId &&
                    this.projectEngine.getProject()?.metadata?.id === projectId &&
                    this.photoDecisions === next
                ) {
                    this.photoDecisions = this.photoDecisionsPersisted;
                    const metadata =
                        this.projectEngine.getProject()?.metadata;
                    if (metadata) {
                        this.projectEngine.updateMetadata({
                            ...metadata,
                            photoDecisions: this.photoDecisionsPersisted
                        });
                    }
                }
                throw error;
            });
        this.persistencePromise = operation.catch(() => {});
        return operation;

    }

    reconcilePhotoDecisionCache(photos) {

        const previous = this.getPhotoDecisions();
        const next = reconcilePhotoDecisions(previous, photos);
        this.photoDecisions = next;
        return JSON.stringify(previous) !== JSON.stringify(next);

    }

    prioritizePhoto(photo) {

        this.thumbnailQueue.addPriority(photo);

    }

    setVisiblePhotos(photos) {

        if (Array.isArray(photos)) {
            this.thumbnailQueue.setVisible(photos);
            return;
        }

        this.thumbnailQueue.setViewport(photos);

    }

    async release() {

        this.folderChangeTransactionId++;
        this.importRequestId++;
        this.lifecycleGeneration++;
        this.performance.trace(
            "PHOTO_WORKSPACE_RELEASE",
            {
                generation: this.lifecycleGeneration,
                photos: this.library.getPhotos().length
            }
        );
        this.thumbnailQueue.clear({
            workspaceGeneration: this.lifecycleGeneration
        });
        await this.thumbnailService.clear({
            reason: "photo-workspace-release",
            workspaceGeneration: this.lifecycleGeneration
        });
        this.selection.clear();
        this.library.load([]);
        this.sourceFolder = null;
        this.photoDecisionProjectId = null;
        this.photoDecisions = normalizePhotoDecisions();
        this.photoDecisionsPersisted = this.photoDecisions;

    }

    sameFolder(left, right) {

        if (!left || !right) return false;

        return left === right ||
            (
                left.nativePath &&
                right.nativePath &&
                left.nativePath === right.nativePath
            );

    }

    async persistProjectState(
        persistenceReason =
            "PHOTO_FOLDER_PERSISTENCE"
    ) {

        const source = this.sourceFolder;
        const tokenStarted =
            this.performance.timestamp();
        const token = await this.createFolderToken(source);
        const persistentTokenMs = Math.round(
            (
                this.performance.timestamp() -
                tokenStarted
            ) * 10
        ) / 10;
        const photoSource = {
            name: source.name,
            token
        };

        await this.projectService.saveProject({
            photoCount: this.library.getPhotos().length,
            photoDecisions: this.getPhotoDecisions(),
            photoSource
        }, { reason: persistenceReason });
        this.photoDecisionsPersisted = this.photoDecisions;

        return { persistentTokenMs };

    }

    async createFolderToken(folder) {

        if (
            typeof this.localFileSystem.createPersistentToken !==
            "function"
        ) {
            return null;
        }

        try {

            return await this.localFileSystem.createPersistentToken(
                folder
            );

        }

        catch (_) {

            return null;

        }

    }

    async createRequiredFolderToken(folder) {

        if (
            typeof this.localFileSystem.createPersistentToken !==
            "function"
        ) {
            throw new Error(
                "Persistent folder tokens are unavailable."
            );
        }

        const token = await this.localFileSystem
            .createPersistentToken(folder);
        if (typeof token !== "string" || !token.trim()) {
            throw new Error(
                "The selected folder could not be persisted."
            );
        }
        return token;

    }

    isCurrentFolderChange(transactionId) {

        return transactionId === null ||
            transactionId === this.folderChangeTransactionId;

    }

    supersededFolderChange(transactionId) {

        this.traceFolderChange(
            "PHOTO_FOLDER_CHANGE_SUPERSEDED",
            { transactionId: transactionId || null }
        );
        return folderChangeResult(
            PhotoFolderChangeStatus.SUPERSEDED,
            { transactionId: transactionId || null }
        );

    }

    folderChangeFailure(
        transactionId,
        status,
        error,
        counts = undefined
    ) {

        this.traceFolderChange(
            "PHOTO_FOLDER_CHANGE_FAILED",
            {
                transactionId,
                status,
                counts,
                errorName: error?.name || "Error"
            }
        );
        return folderChangeResult(
            status,
            {
                transactionId,
                counts,
                error:
                    error?.message || "Photo folder change failed."
            }
        );

    }

    traceFolderChange(event, details) {

        this.performance.trace(event, details);

    }

    reactivateCurrentPhotoWorkspace() {

        this.thumbnailService.activateWorkspace(
            this.lifecycleGeneration
        );
        this.thumbnailQueue.activateGeneration(
            this.lifecycleGeneration
        );
        this.refreshService.refresh();

    }

    async rollbackPersistedFolderChange(
        previousMetadata,
        transactionId
    ) {

        try {
            await this.projectService.saveProject(
                previousMetadata,
                { reason: "PHOTO_FOLDER_CHANGE_ROLLBACK" }
            );
        } catch (error) {
            this.traceFolderChange(
                "PHOTO_FOLDER_CHANGE_ROLLBACK_FAILURE",
                {
                    transactionId,
                    errorName: error?.name || "Error"
                }
            );
        } finally {
            this.projectEngine.updateMetadata(previousMetadata);
            this.photoDecisions = normalizePhotoDecisions(
                previousMetadata?.photoDecisions
            );
            this.photoDecisionsPersisted = this.photoDecisions;
            this.reactivateCurrentPhotoWorkspace();
        }

    }

    async resolveSourceFolder() {

        const metadata = this.projectEngine.getProject()?.metadata;
        const token = metadata?.photoSource?.token;

        if (
            !token ||
            typeof this.localFileSystem.getEntryForPersistentToken !==
            "function"
        ) {
            return null;
        }

        try {

            return await this.localFileSystem
                .getEntryForPersistentToken(token);

        }

        catch (_) {

            return null;

        }

    }

    async writeMetadataCache(photoSnapshot = null) {

        const metadataFolder =
            this.projectEngine.getProject()?.workspace?.cache?.metadata;

        if (!metadataFolder) {
            throw new Error("Project metadata cache is unavailable.");
        }

        const file = await metadataFolder.createFile(
            METADATA_FILE,
            { overwrite: true }
        );

        const sourcePhotos = Array.isArray(photoSnapshot)
            ? photoSnapshot
            : this.library.getPhotos();
        const photos = sourcePhotos.map(photo => ({
            id: photo.id,
            name: photo.name,
            extension: photo.extension,
            width: photo.width,
            height: photo.height,
            orientation: photo.orientation,
            fileSize: photo.fileSize,
            created: photo.created,
            modified: photo.modified
        }));

        const serialized = JSON.stringify(
            { photos },
            null,
            2
        );
        await file.write(serialized);

    }

    requireProject() {

        if (!this.projectEngine.isOpen()) {
            throw new Error("Open a project before managing photos.");
        }

    }

}
