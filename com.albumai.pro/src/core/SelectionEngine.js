export default class SelectionEngine {

    constructor(library) {

        this.library = library;

    }

    select(photo) {

        this.clear();

        photo.selected = true;

    }

    toggle(photo) {

        photo.selected = !photo.selected;

    }

    selectAll() {

        this.library.getPhotos().forEach(photo => {

            photo.selected = true;

        });

    }

    clear() {

        this.library.getPhotos().forEach(photo => {

            photo.selected = false;

        });

    }

    getSelected() {

        return this.library
            .getPhotos()
            .filter(photo => photo.selected);

    }

}