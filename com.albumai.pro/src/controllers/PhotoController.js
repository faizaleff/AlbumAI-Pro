import AlbumAIPro from "../index";

class PhotoController {

    constructor() {

        this.photos = [];

    }

    setPhotos(photos = []) {

        this.photos = photos;

        AlbumAIPro.core.state.set(
            "photos",
            photos
        );

        AlbumAIPro.core.events.emit(
            "photos:loaded",
            photos
        );

        return photos;

    }

    getPhotos() {

        return this.photos;

    }

    get(index) {

        return this.photos[index] || null;

    }

    add(photo) {

        this.photos.push(photo);

        AlbumAIPro.core.state.set(
            "photos",
            this.photos
        );

        AlbumAIPro.core.events.emit(
            "photo:added",
            photo
        );

        return photo;

    }

    remove(photo) {

        this.photos = this.photos.filter(

            item => item !== photo

        );

        AlbumAIPro.core.state.set(
            "photos",
            this.photos
        );

        AlbumAIPro.core.events.emit(
            "photo:removed",
            photo
        );

    }

    async metadata(photo) {

        return AlbumAIPro.services.metadata.load(photo);

    }

    async thumbnail(photo) {

        return AlbumAIPro.services.thumbnails.getThumbnail(photo);

    }

    async thumbnails() {

        return Promise.all(

            this.photos.map(photo =>

                this.thumbnail(photo)

            )

        );

    }

    async search(query) {

        return AlbumAIPro.services.search.search(

            this.photos,

            query

        );

    }

    select(photo, event = {}) {

        AlbumAIPro.services.selection.handleClick(

            photo,

            this.photos,

            event

        );

        AlbumAIPro.core.events.emit(

            "photo:selected",

            photo

        );

    }

    selected() {

        return AlbumAIPro.services.selection.getSelected();

    }

    selectedCount() {

        return AlbumAIPro.services.selection.count();

    }

    clearSelection() {

        AlbumAIPro.services.selection.clear();

        AlbumAIPro.core.events.emit(

            "selection:cleared"

        );

    }

    count() {

        return this.photos.length;

    }

    clear() {

        this.photos = [];

        this.clearSelection();

        AlbumAIPro.core.state.set(

            "photos",

            []

        );

        AlbumAIPro.core.events.emit(

            "photos:cleared"

        );

    }

}

export default new PhotoController();