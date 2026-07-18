class AlbumProject {

    constructor() {

        this.name = "";

        this.folder = null;

        this.photos = [];

        this.selectedPhotos = [];

        this.template = null;

        this.created = new Date();

        this.modified = new Date();

        this.settings = {

            albumSize: "12x36",

            dpi: 300,

            bleed: 3,

            colorSpace: "sRGB",

            autoSave: true,

            autoBackup: true

        };

    }

    setName(name) {

        this.name = name;

        this.touch();

    }

    setFolder(folder) {

        this.folder = folder;

        this.touch();

    }

    setPhotos(photos = []) {

        this.photos = photos;

        this.touch();

    }

    setTemplate(template) {

        this.template = template;

        this.touch();

    }

    setSelectedPhotos(photos = []) {

        this.selectedPhotos = photos;

        this.touch();

    }

    addPhoto(photo) {

        this.photos.push(photo);

        this.touch();

    }

    removePhoto(photo) {

        this.photos = this.photos.filter(p => p !== photo);

        this.selectedPhotos =
            this.selectedPhotos.filter(p => p !== photo);

        this.touch();

    }

    clearSelection() {

        this.selectedPhotos = [];

        this.touch();

    }

    getSelectionCount() {

        return this.selectedPhotos.length;

    }

    getPhotoCount() {

        return this.photos.length;

    }

    touch() {

        this.modified = new Date();

    }

    toJSON() {

        return {

            name: this.name,

            created: this.created,

            modified: this.modified,

            settings: this.settings,

            template: this.template,

            photoCount: this.photos.length,

            selectedCount: this.selectedPhotos.length

        };

    }

}

export default AlbumProject;