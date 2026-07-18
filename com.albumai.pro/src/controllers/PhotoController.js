import AlbumAIPro from "../index";
import ThumbnailQueue from "../queue/ThumbnailQueue";

class PhotoController {

    constructor() {

        this.photos = [];

    }

    setPhotos(photos = []) {

        this.photos = photos;

        ThumbnailQueue.clear();

        ThumbnailQueue.addBatch(photos);

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

        return this.photos[index] ?? null;

    }

    add(photo) {

        if (!photo) {
            return null;
        }

        this.photos.push(photo);

        ThumbnailQueue.add(photo);

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

    addMany(photos = []) {

        if (!photos.length) {
            return;
        }

        this.photos.push(...photos);

        ThumbnailQueue.addBatch(photos);

        AlbumAIPro.core.state.set(
            "photos",
            this.photos
        );

        AlbumAIPro.core.events.emit(
            "photos:added",
            photos
        );

    }

    remove(photo) {

        const index = this.photos.indexOf(photo);

        if (index === -1) {
            return;
        }

        this.photos.splice(index, 1);

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

        ThumbnailQueue.addBatch(this.photos);

        return this.photos;

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

    refresh() {

        AlbumAIPro.core.events.emit(
            "photos:updated",
            this.photos
        );

    }

    clear() {

        ThumbnailQueue.clear();

        this.photos.length = 0;

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