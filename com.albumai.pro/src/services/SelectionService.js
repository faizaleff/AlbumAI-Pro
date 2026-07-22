class SelectionService {

    constructor() {

        this.photos = [];
        this.lastSelectedIndex = -1;
        this.lastSelectedPhotoId = null;
        this.selectedCount = 0;

    }

    setPhotos(photos = []) {

        this.photos = (Array.isArray(photos) ? photos : [])
            .filter(Boolean);
        this.selectedCount = this.photos.reduce(
            (count, photo) => count + (photo.selected ? 1 : 0),
            0
        );
        this.syncAnchor();

    }

    clear() {

        if (!this.selectedCount) {
            this.lastSelectedIndex = -1;
            this.lastSelectedPhotoId = null;
            return;
        }

        this.photos.forEach(photo => {

            if (photo) photo.selected = false;

        });

        this.selectedCount = 0;
        this.lastSelectedIndex = -1;
        this.lastSelectedPhotoId = null;

    }

    select(photo) {

        const index = this.photos.indexOf(photo);

        if (index === -1 || !photo) return;

        this.clear();

        photo.selected = true;

        this.selectedCount = 1;
        this.setAnchor(index, photo);

    }

    toggle(photo) {

        const index = this.photos.indexOf(photo);

        if (index === -1 || !photo) return;

        photo.selected = !photo.selected;

        if (photo.selected) {

            this.selectedCount++;

        } else {

            this.selectedCount = Math.max(0, this.selectedCount - 1);

        }

        this.setAnchor(index, photo);

    }

    range(photo) {

        const currentIndex = this.photos.indexOf(photo);

        if (currentIndex === -1 || !this.photos.length) {
            return;
        }

        const anchorIndex = this.anchorIndex();

        if (anchorIndex === -1) {

            this.select(photo);
            return;

        }

        this.clear();

        const start = Math.max(0, Math.min(anchorIndex, currentIndex));
        const end = Math.min(
            this.photos.length - 1,
            Math.max(anchorIndex, currentIndex)
        );
        let count = 0;

        for (let i = start; i <= end; i++) {

            const item = this.photos[i];

            if (!item) continue;

            item.selected = true;
            count += 1;

        }

        this.selectedCount = count;
        this.setAnchor(currentIndex, photo);

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

            if (photo) photo.selected = true;

        });

        this.selectedCount = this.photos.length;

    }

    invert() {

        let count = 0;

        this.photos.forEach(photo => {

            if (!photo) return;

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

    syncAnchor() {

        if (!this.lastSelectedPhotoId) {
            this.lastSelectedIndex = -1;
            return;
        }

        const index = this.photos.findIndex(photo =>
            photo?.id === this.lastSelectedPhotoId
        );

        if (index === -1) {
            this.lastSelectedIndex = -1;
            this.lastSelectedPhotoId = null;
            return;
        }

        this.lastSelectedIndex = index;

    }

    anchorIndex() {

        this.syncAnchor();

        return this.lastSelectedIndex >= 0 &&
            this.lastSelectedIndex < this.photos.length
            ? this.lastSelectedIndex
            : -1;

    }

    setAnchor(index, photo) {

        this.lastSelectedIndex = index;
        this.lastSelectedPhotoId = photo?.id ?? null;

    }

}

export default new SelectionService();
