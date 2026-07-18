import ThumbnailService from "../services/ThumbnailService";
import RefreshService from "../services/RefreshService";

class ThumbnailWorker {

    constructor() {

        this.queue = [];
        this.running = 0;

        this.maxWorkers = 4;

        this.processing = new Set();

        this.cancelled = false;

    }

    add(photo) {

        if (!photo) return;

        if (photo.loaded || photo.loading) return;

        if (this.processing.has(photo)) return;

        if (this.queue.includes(photo)) return;

        this.queue.push(photo);

        this.process();

    }

    addPriority(photo) {

        if (!photo) return;

        if (photo.loaded || photo.loading) return;

        if (this.processing.has(photo)) return;

        if (this.queue.includes(photo)) return;

        this.queue.unshift(photo);

        this.process();

    }

    async process() {

        while (

            this.running < this.maxWorkers &&
            this.queue.length > 0 &&
            !this.cancelled

        ) {

            const photo = this.queue.shift();

            this.running++;

            this.processing.add(photo);

            this.run(photo);

        }

    }

    async run(photo) {

        try {

            photo.loading = true;

            RefreshService.refresh();

            const thumbnail = await ThumbnailService.getThumbnail(photo);

            photo.thumbnail = thumbnail;

            photo.loaded = true;

        } catch (error) {

            console.error("ThumbnailWorker:", error);

        } finally {

            photo.loading = false;

            this.processing.delete(photo);

            this.running--;

            RefreshService.refresh();

            this.process();

        }

    }

    clear() {

        this.cancelled = true;

        this.queue = [];

        this.processing.clear();

        this.running = 0;

        this.cancelled = false;

    }

    size() {

        return this.queue.length;

    }

    busy() {

        return this.running > 0;

    }

}

export default new ThumbnailWorker();