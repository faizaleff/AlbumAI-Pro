import AlbumAIPro from "../index";

class FolderController {

    constructor() {

        this.folder = null;

        this.photos = [];

    }

    async open(folder) {

        if (!folder)
            throw new Error("Folder is required.");

        this.folder = folder;

        const entries = await folder.getEntries();

        this.photos = entries.filter(entry => {

            if (!entry.isFile)
                return false;

            const name = entry.name.toLowerCase();

            return (

                name.endsWith(".jpg") ||

                name.endsWith(".jpeg") ||

                name.endsWith(".png") ||

                name.endsWith(".tif") ||

                name.endsWith(".tiff") ||

                name.endsWith(".webp")

            );

        });

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

        return this.photos;

    }

    async refresh() {

        if (!this.folder)
            throw new Error("No folder selected.");

        return this.open(this.folder);

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

        this.folder = null;

        this.photos = [];

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