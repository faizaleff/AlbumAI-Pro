export default class LibraryEngine {

    constructor() {

        this.photos = [];

    }

    load(photos) {

        this.photos = photos;

    }

    getPhotos() {

        return this.photos;

    }

    getSelected() {

        return this.photos.filter(photo => photo.selected);

    }

    clearSelection() {

        this.photos.forEach(photo => {

            photo.selected = false;

        });

    }

}