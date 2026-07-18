export default class Photo {

    constructor(file) {

        // UXP File
        this.file = file;

        // Basic
        this.name = file.name;
        this.extension = this.getExtension(file.name);

        // Images
        this.thumbnail = null;
        this.preview = null;

        // UI
        this.selected = false;
        this.favorite = false;
        this.rating = 0;

        // AI
        this.aiScore = 0;
        this.tags = [];
        this.category = "";

        // Metadata
        this.width = 0;
        this.height = 0;
        this.fileSize = file.size || 0;
        this.created = file.created || null;
        this.modified = file.modified || null;

        // Loading
        this.loaded = false;
        this.loading = false;

    }

    getExtension(filename) {

        const index = filename.lastIndexOf(".");

        return index === -1
            ? ""
            : filename.substring(index + 1).toLowerCase();

    }

}