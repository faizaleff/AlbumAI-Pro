import AlbumAIPro from "../index";
import Photo from "../models/Photo";

const SUPPORTED_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "tif",
    "tiff",
    "webp",
    "psd"
]);

class FolderController {

    constructor() {

        this.folder = null;
        this.photos = [];
        this.loading = false;
        this.cancelled = false;

    }

    async open(folder) {

        if (!folder) {
            throw new Error("Folder is required.");
        }

        this.folder = folder;
        this.loading = true;
        this.cancelled = false;

        AlbumAIPro.core.events.emit("folder:loading");

        const entries = await folder.getEntries();

        const photos = [];
        const total = entries.length;

        for (let i = 0; i < total; i++) {

            if (this.cancelled) {
                break;
            }

            const entry = entries[i];

            if (!entry.isFile) {
                continue;
            }

            const extension =
                entry.name.split(".").pop()?.toLowerCase();

            if (!SUPPORTED_EXTENSIONS.has(extension)) {
                continue;
            }

            photos.push(new Photo(entry));

            if (i % 100 === 0) {

                AlbumAIPro.core.events.emit(
                    "folder:progress",
                    {
                        current: i,
                        total
                    }
                );

                await Promise.resolve();

            }

        }

        this.photos = photos;

        AlbumAIPro.core.state.update({
            folder: this.folder,
            photos: this.photos
        });

        AlbumAIPro.core.events.emit(
            "folder:opened",
            {
                folder: this.folder,
                photos: this.photos
            }
        );

        this.loading = false;

        return this.photos;

    }

    cancel() {

        this.cancelled = true;

    }

    async refresh() {

        if (!this.folder) {
            throw new Error("No folder selected.");
        }

        return this.open(this.folder);

    }

    isLoading() {

        return this.loading;

    }

    getFolder() {

        return this.folder;

    }

    getPhotos() {

        return this.photos;

    }

    count() {

        return this.photos.length;

    }

    clear() {

        this.cancel();

        this.folder = null;
        this.photos = [];
        this.loading = false;

        AlbumAIPro.core.state.update({
            folder: null,
            photos: []
        });

        AlbumAIPro.core.events.emit(
            "folder:cleared"
        );

    }

}

export default new FolderController();