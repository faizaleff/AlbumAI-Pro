export default class Photo {

    constructor(file) {

        // File
        this.file = file;

        // Identity
        this.id =
            file.nativePath ||
            file.name ||
            `${Date.now()}-${Math.random()}`;

        this.name = file.name;
        this.extension = this.getExtension(file.name);

        // Images
        this.thumbnail = null;
        this.preview = null;

        // UI
        this.selected = false;
        this.favorite = false;
        this.rating = 0;
        this.hidden = false;
        this.rejected = false;

        // AI
        this.aiScore = 0;
        this.tags = [];
        this.category = "";
        this.faces = [];
        this.duplicateGroup = null;
        this.blurScore = 0;
        this.smileScore = 0;

        // Metadata
        this.width = 0;
        this.height = 0;
        this.orientation = 1;
        this.fileSize = file.size || 0;
        this.created = file.created || null;
        this.modified = file.modified || null;

        // Loading
        this.loaded = false;
        this.loading = false;
        this.error = false;

        // Cache
        this.thumbnailLoaded = false;
        this.previewLoaded = false;
        this.lastAccess = 0;

    }

    getExtension(filename) {

        const index = filename.lastIndexOf(".");

        return index === -1
            ? ""
            : filename.substring(index + 1).toLowerCase();

    }

    markAccess() {

        this.lastAccess = Date.now();

    }

    setThumbnail(thumbnail) {

        this.thumbnail = thumbnail;
        this.thumbnailLoaded = !!thumbnail;
        this.loading = false;

    }

    clearThumbnail() {

        this.thumbnail = null;
        this.thumbnailLoaded = false;

    }

    setPreview(preview) {

        this.preview = preview;
        this.previewLoaded = !!preview;

    }

    clearPreview() {

        this.preview = null;
        this.previewLoaded = false;

    }

    reset() {

        this.selected = false;
        this.loading = false;
        this.loaded = false;
        this.error = false;

        this.clearThumbnail();
        this.clearPreview();

    }

}