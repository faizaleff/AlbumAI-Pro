import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

export default class SelectionEngine {

    constructor(library) {

        this.library = library;
        this.ids = new Set();
        this.anchorId = null;
        this.listeners = new Set();
        this.indexedPhotos = null;
        this.photosById = new Map();
        this.orderedIds = null;

    }

    subscribe(listener) {

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };

    }

    selectedIds() {

        return new Set(this.ids);

    }

    isSelected(photoOrId) {

        const id = typeof photoOrId === "object"
            ? photoOrId?.id
            : photoOrId;

        return id != null && this.ids.has(id);

    }

    select(photo) {

        if (!photo?.id) return;
        this.apply(new Set([photo.id]), photo.id, "select");

    }

    toggle(photo) {

        if (!photo?.id) return;

        const next = new Set(this.ids);

        if (next.has(photo.id)) {
            next.delete(photo.id);
        } else {
            next.add(photo.id);
        }

        this.apply(next, this.anchorId, "toggle");

    }

    range(photo) {

        const orderedIds = this.order();
        const currentIndex = orderedIds.indexOf(photo?.id);
        const anchorIndex = orderedIds.indexOf(this.anchorId);

        if (currentIndex < 0) return;

        if (anchorIndex < 0) {
            this.select(photo);
            return;
        }

        const start = Math.min(anchorIndex, currentIndex);
        const end = Math.max(anchorIndex, currentIndex);
        const next = new Set();

        for (let index = start; index <= end; index++) {
            const id = orderedIds[index];
            if (id != null) next.add(id);
        }

        this.apply(next, photo.id, "range");

    }

    handleClick(photo, event = {}) {

        if (event.shiftKey) {
            this.range(photo);
        } else if (event.ctrlKey || event.metaKey) {
            this.toggle(photo);
        } else {
            this.select(photo);
        }

    }

    selectAll() {

        const next = new Set(this.order());

        this.apply(next, this.anchorId, "select-all");

    }

    clear() {

        this.apply(new Set(), null, "clear");

    }

    getSelected() {

        return this.library.getPhotos().filter(
            photo => this.ids.has(photo?.id)
        );

    }

    setOrderedPhotos(photos = []) {

        this.orderedIds = (Array.isArray(photos) ? photos : [])
            .map(photo => photo?.id)
            .filter(id => id != null);

    }

    order() {

        if (Array.isArray(this.orderedIds)) {
            return this.orderedIds;
        }

        return this.library.getPhotos()
            .map(photo => photo?.id)
            .filter(id => id != null);

    }

    apply(next, anchorId, operation) {

        const started =
            PhotoBrowserPerformance.timestamp();
        const previous = this.ids;
        const changedIds = new Set();
        const photosById = this.photoIndex();

        for (const id of previous) {
            if (!next.has(id)) {
                changedIds.add(id);
                const photo = photosById.get(id);
                if (photo) photo.selected = false;
            }
        }

        for (const id of next) {
            if (!previous.has(id)) {
                changedIds.add(id);
                const photo = photosById.get(id);
                if (photo) photo.selected = true;
            }
        }

        this.ids = next;
        this.anchorId = anchorId;

        const snapshot = this.selectedIds();

        for (const listener of this.listeners) {
            listener(snapshot, changedIds);
        }

        PhotoBrowserPerformance.recordSelection({
            operation,
            durationMs:
                PhotoBrowserPerformance.timestamp() - started,
            selected: next.size,
            changed: changedIds.size,
            photoObjectsReplaced: 0
        });

    }

    photoIndex() {

        const photos = this.library.getPhotos();

        if (photos === this.indexedPhotos) {
            return this.photosById;
        }

        this.indexedPhotos = photos;
        this.photosById = new Map(
            photos.map(photo => [photo?.id, photo])
        );

        return this.photosById;

    }

}
