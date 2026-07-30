import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

export const ThumbnailPriority = Object.freeze({
    SELECTED: 0,
    VISIBLE: 1,
    OVERSCAN: 2,
    REMAINING: 3
});

class ThumbnailQueue {

    constructor() {

        this.generation = 0;
        this.workspaceGeneration = 0;
        this.acceptingViewport = false;
        this.viewportPhotos = new Set();
        this.onThumbnailReady = null;

    }

    add(photo) {

        // Image work is owned by mounted PhotoImage components. Keeping this
        // legacy API passive prevents folder scans and controller calls from
        // decoding photos outside the virtualized browser window.
        if (this.acceptingViewport && photo) {
            this.viewportPhotos.add(photo);
        }

    }

    addBatch(photos = []) {

        for (const photo of photos) {
            if (this.acceptingViewport && photo) {
                this.viewportPhotos.add(photo);
            }
        }

    }

    addPriority(photo) {

        if (this.acceptingViewport && photo) {
            this.viewportPhotos.add(photo);
        }

    }

    setVisible(photos = []) {

        if (this.acceptingViewport) {
            this.viewportPhotos = new Set(photos);
        }

    }

    setViewport({ visible = [], overscan = [] } = {}) {

        if (this.acceptingViewport) {
            const photos = [...visible, ...overscan];
            this.viewportPhotos = new Set(photos);
        }

    }

    setListener(callback) {

        this.onThumbnailReady = callback;

    }

    clear({
        discardResults = true,
        workspaceGeneration = this.workspaceGeneration + 1
    } = {}) {

        PhotoBrowserPerformance.trace("QUEUE_CANCEL", {
            generation: this.generation,
            workspaceGeneration,
            queued: 0,
            active: 0,
            discardResults
        });
        this.generation++;
        this.workspaceGeneration = Math.max(
            this.workspaceGeneration,
            workspaceGeneration
        );
        this.acceptingViewport = false;
        this.viewportPhotos.clear();

    }

    activateGeneration(workspaceGeneration) {

        if (workspaceGeneration !== this.workspaceGeneration) return false;
        this.acceptingViewport = true;
        return true;

    }

    size() {

        return 0;

    }

    isBusy() {

        return false;

    }

}

export default new ThumbnailQueue();
