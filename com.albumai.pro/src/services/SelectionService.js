class SelectionService {

    constructor() {

        this.photos = [];
        this.lastSelectedIndex = -1;

    }

    setPhotos(photos = []) {

        this.photos = photos;

    }

    clear() {

        this.photos.forEach(photo => {

            photo.selected = false;

        });

        this.lastSelectedIndex = -1;

    }

    select(photo) {

        this.clear();

        photo.selected = true;

        this.lastSelectedIndex = this.photos.indexOf(photo);

    }

    toggle(photo) {

        photo.selected = !photo.selected;

        this.lastSelectedIndex = this.photos.indexOf(photo);

    }

    range(photo) {

        const currentIndex = this.photos.indexOf(photo);

        if (currentIndex === -1)
            return;

        if (this.lastSelectedIndex === -1) {

            this.select(photo);
            return;

        }

        this.clear();

        const start = Math.min(
            this.lastSelectedIndex,
            currentIndex
        );

        const end = Math.max(
            this.lastSelectedIndex,
            currentIndex
        );

        for (let i = start; i <= end; i++) {

            this.photos[i].selected = true;

        }

    }

    handleClick(photo, event) {

        const ctrl =
            event.ctrlKey || event.metaKey;

        const shift =
            event.shiftKey;

        if (shift) {

            this.range(photo);
            return;

        }

        if (ctrl) {

            this.toggle(photo);
            return;

        }

        this.select(photo);

    }

    selectAll() {

        this.photos.forEach(photo => {

            photo.selected = true;

        });

    }

    invert() {

        this.photos.forEach(photo => {

            photo.selected = !photo.selected;

        });

    }

    getSelected() {

        return this.photos.filter(photo => photo.selected);

    }

    count() {

        return this.getSelected().length;

    }

}

export default new SelectionService();