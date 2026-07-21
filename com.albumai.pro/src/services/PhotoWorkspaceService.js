import { storage } from "uxp";

import { importPhotoFolder } from "./FolderService";
import ThumbnailService from "./ThumbnailService";
import RefreshService from "./RefreshService";
import ThumbnailWorker from "../queue/ThumbnailWorker";

const METADATA_FILE = "photos.json";

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

    }

    async importPhotos(folder = null) {

        this.requireProject();

        const sourceFolder = folder ||
            await this.localFileSystem.getFolder();

        if (!sourceFolder) {
            return null;
        }

        const result = await importPhotoFolder(sourceFolder);

        if (!result) {
            return null;
        }

        this.sourceFolder = result.folder;
        ThumbnailWorker.clear();
        ThumbnailService.clear();
        this.selection.clear();
        this.library.load(result.images);

        for (const photo of result.images) {
            ThumbnailWorker.add(photo);
        }

        await this.persistProjectState();
        await this.writeMetadataCache();

        RefreshService.refresh();

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

    async removePhotos() {

        this.requireProject();

        ThumbnailWorker.clear();
        ThumbnailService.clear();
        this.selection.clear();
        this.library.load([]);
        this.sourceFolder = null;

        await this.projectService.saveProject({
            photoCount: 0,
            photoSource: null
        });
        await this.writeMetadataCache();

        RefreshService.refresh();

    }

    getPhotos() {

        return this.library.getPhotos();

    }

    async persistProjectState() {

        const source = this.sourceFolder;
        const photoSource = {
            name: source.name,
            token: await this.createFolderToken(source)
        };

        await this.projectService.saveProject({
            photoCount: this.library.getPhotos().length,
            photoSource
        });

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

        await file.write(JSON.stringify({ photos }, null, 2));

    }

    requireProject() {

        if (!this.projectEngine.isOpen()) {
            throw new Error("Open a project before managing photos.");
        }

    }

}
