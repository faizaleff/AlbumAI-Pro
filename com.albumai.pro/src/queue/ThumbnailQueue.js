import ThumbnailService from "../services/ThumbnailService";
import RefreshService from "../services/RefreshService";

const MAX_CONCURRENT = 4;

class ThumbnailQueue {

    constructor() {

        this.queue = [];
        this.running = 0;
        this.processing = false;
        this.onThumbnailReady = null;

    }

    add(photo) {

        if (!photo) return;

        this.queue.push(photo);

        this.process();

    }

    addBatch(photos = []) {

        if (!photos.length) return;

        this.queue.push(...photos);

        this.process();

    }

    async process() {

        if (this.processing) return;

        this.processing = true;

        while (this.running < MAX_CONCURRENT && this.queue.length) {

            const photo = this.queue.shift();

            this.running++;

            this.processPhoto(photo);

        }

        this.processing = false;

    }

    async processPhoto(photo) {

        try {

            const thumbnail =
                await ThumbnailService.getThumbnail(photo);

            if (thumbnail) {

                photo.thumbnail = thumbnail;
                photo.loaded = true;

                if (typeof this.onThumbnailReady === "function") {

                    this.onThumbnailReady(photo);

                }

                RefreshService.refresh();

            }

        } catch (error) {

            console.error("ThumbnailQueue:", error);

        } finally {

            photo.loading = false;
            this.running--;

            this.process();

        }

    }

    setListener(callback) {

        this.onThumbnailReady = callback;

    }

    clear() {

        this.queue.length = 0;
        this.running = 0;

    }

    size() {

        return this.queue.length;

    }

    isBusy() {

        return this.running > 0 || this.queue.length > 0;

    }

}

export default new ThumbnailQueue();
