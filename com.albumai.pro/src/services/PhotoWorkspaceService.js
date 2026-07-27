import { storage } from "uxp";

import { importPhotoFolder } from "./FolderService";
import ThumbnailService from "./ThumbnailService";
import RefreshService from "./RefreshService";
import ThumbnailQueue, {
    ThumbnailPriority
} from "../queue/ThumbnailQueue";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";
import { logPhotoRuntimeSchemaOnce } from "./PhotoFileEntry";

const METADATA_FILE = "photos.json";
const INITIAL_VISIBLE_PHOTOS = 30;
const INITIAL_OVERSCAN_PHOTOS = 30;

export default class PhotoWorkspaceService {

    constructor({
        library,
        selection,
        projectEngine,
        projectService,
        localFileSystem = storage.localFileSystem
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
        this.sourceFolder = null;
        this.persistencePromise = Promise.resolve();
        this.lifecycleGeneration = 0;

    }

    async importPhotos(folder = null) {

        this.requireProject();
        const persistenceReason = folder
            ? "PHOTO_FOLDER_REFRESH"
            : "PHOTO_FOLDER_IMPORT";

        PhotoBrowserPerformance.beginFolderLoad();

        const sourceFolder = folder ||
            await this.localFileSystem.getFolder();

        PhotoBrowserPerformance.markPickerComplete();

        if (!sourceFolder) {
            return null;
        }

        const result = await importPhotoFolder(sourceFolder);

        if (!result) {
            return null;
        }

        const sameFolder = this.sameFolder(
            this.sourceFolder,
            result.folder
        );
        const previousPhotos = this.library.getPhotos();
        const previousById = new Map(
            previousPhotos.map(photo => [photo?.id, photo])
        );
        const images = sameFolder
            ? result.images.map(photo => previousById.get(photo.id) || photo)
            : result.images;
        const reused = sameFolder
            ? images.filter(photo => previousById.get(photo.id) === photo).length
            : 0;

        this.lifecycleGeneration++;
        PhotoBrowserPerformance.trace(
            "FOLDER_SWITCH",
            {
                generation: this.lifecycleGeneration,
                previousFolder:
                    this.sourceFolder?.name || null,
                nextFolder: result.folder?.name || null,
                sameFolder
            }
        );
        ThumbnailQueue.clear({
            discardResults: !sameFolder
        });
        ThumbnailService.clear({
            preserveCache: sameFolder
        });
        this.sourceFolder = result.folder;
        if (!sameFolder) this.selection.clear();
        // Placeholder mode is the normal browser fallback. Cache hydration is
        // only useful when this bounded session cache already has entries;
        // never start work for uncached originals here.
        if (ThumbnailService.hasCachedThumbnails()) {
            for (const photo of images) {
                ThumbnailService.restoreCachedThumbnail(photo);
            }
        }
        this.library.load(images);
        logPhotoRuntimeSchemaOnce(images[0]);
        PhotoBrowserPerformance.trace(
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
        PhotoBrowserPerformance.markPublishRequested();
        RefreshService.refresh();

        const visible = images.slice(
            0,
            INITIAL_VISIBLE_PHOTOS
        );
        const overscan = images.slice(
            INITIAL_VISIBLE_PHOTOS,
            INITIAL_VISIBLE_PHOTOS + INITIAL_OVERSCAN_PHOTOS
        );
        ThumbnailQueue.addBatch(
            visible,
            ThumbnailPriority.VISIBLE
        );
        ThumbnailQueue.addBatch(
            overscan,
            ThumbnailPriority.OVERSCAN
        );
        ThumbnailQueue.addBatch(
            images.slice(
                INITIAL_VISIBLE_PHOTOS + INITIAL_OVERSCAN_PHOTOS
            )
        );

        // Project metadata writes are not part of the folder-open critical
        // path. Keep them ordered and report failures without blocking paint.
        this.persistencePromise = this.persistencePromise
            .catch(() => {})
            .then(async () => {
                const persistenceStarted =
                    PhotoBrowserPerformance.timestamp();
                const { persistentTokenMs } =
                    await this.persistProjectState(
                        persistenceReason
                    );
                await this.writeMetadataCache();
                const persistenceCompleted =
                    PhotoBrowserPerformance.timestamp();
                PhotoBrowserPerformance.recordPersistence({
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

        this.lifecycleGeneration++;
        PhotoBrowserPerformance.trace(
            "PHOTO_WORKSPACE_REMOVE",
            {
                generation: this.lifecycleGeneration,
                photos: this.library.getPhotos().length
            }
        );
        ThumbnailQueue.clear();
        ThumbnailService.clear();
        this.selection.clear();
        this.library.load([]);
        this.sourceFolder = null;

        await this.projectService.saveProject({
            photoCount: 0,
            photoSource: null
        }, { reason: "PHOTO_FOLDER_REMOVE" });
        await this.writeMetadataCache();

        RefreshService.refresh();

    }

    getPhotos() {

        return this.library.getPhotos();

    }

    prioritizePhoto(photo) {

        ThumbnailQueue.addPriority(photo);

    }

    setVisiblePhotos(photos) {

        if (Array.isArray(photos)) {
            ThumbnailQueue.setVisible(photos);
            return;
        }

        ThumbnailQueue.setViewport(photos);

    }

    release() {

        this.lifecycleGeneration++;
        PhotoBrowserPerformance.trace(
            "PHOTO_WORKSPACE_RELEASE",
            {
                generation: this.lifecycleGeneration,
                photos: this.library.getPhotos().length
            }
        );
        ThumbnailQueue.clear();
        ThumbnailService.clear();
        this.selection.clear();
        this.library.load([]);
        this.sourceFolder = null;

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
            PhotoBrowserPerformance.timestamp();
        const token = await this.createFolderToken(source);
        const persistentTokenMs = Math.round(
            (
                PhotoBrowserPerformance.timestamp() -
                tokenStarted
            ) * 10
        ) / 10;
        const photoSource = {
            name: source.name,
            token
        };

        await this.projectService.saveProject({
            photoCount: this.library.getPhotos().length,
            photoSource
        }, { reason: persistenceReason });

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

    async writeMetadataCache() {

        const metadataFolder =
            this.projectEngine.getProject()?.workspace?.cache?.metadata;

        if (!metadataFolder) {
            throw new Error("Project metadata cache is unavailable.");
        }

        const file = await metadataFolder.createFile(
            METADATA_FILE,
            { overwrite: true }
        );

        const photos = this.library.getPhotos().map(photo => ({
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
