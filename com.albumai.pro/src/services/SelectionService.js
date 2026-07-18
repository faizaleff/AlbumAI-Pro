class SelectionService {

    constructor() {

        this.photos = [];
        this.lastSelectedIndex = -1;
        this.selectedCount = 0;

    }

    setPhotos(photos = []) {

        this.photos = photos;
        this.selectedCount = photos.reduce(
            (count, photo) => count + (photo.selected ? 1 : 0),
            0
        );

    }

    clear() {

        if (!this.selectedCount) {
            this.lastSelectedIndex = -1;
            return;
        }

        this.photos.forEach(photo => {

            photo.selected = false;

        });

        this.selectedCount = 0;
        this.lastSelectedIndex = -1;

    }

    select(photo) {

        this.clear();

        photo.selected = true;

        this.selectedCount = 1;
        this.lastSelectedIndex = this.photos.indexOf(photo);

    }

    toggle(photo) {

        photo.selected = !photo.selected;

        if (photo.selected) {

            this.selectedCount++;

        } else {

            this.selectedCount = Math.max(0, this.selectedCount - 1);

        }

        this.lastSelectedIndex = this.photos.indexOf(photo);

    }

    range(photo) {

        const currentIndex = this.photos.indexOf(photo);

        if (currentIndex === -1) {
            return;
        }

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

        this.selectedCount = end - start + 1;

    }

    handleClick(photo, event) {

        const ctrl = event.ctrlKey || event.metaKey;
        const shift = event.shiftKey;

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

        this.selectedCount = this.photos.length;

    }

    invert() {

        let count = 0;

        this.photos.forEach(photo => {

            photo.selected = !photo.selected;

            if (photo.selected) {
                count++;
            }

        });

        this.selectedCount = count;

    }

    getSelected() {

        return this.photos.filter(photo => photo.selected);

    }

    count() {

        return this.selectedCount;

    }

    isSelected(photo) {

        return photo.selected === true;

    }

    hasSelection() {

        return this.selectedCount > 0;

    }

}

export default new SelectionService();