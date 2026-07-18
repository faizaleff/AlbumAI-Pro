class ThumbnailQueue {

    constructor() {

        this.queue = [];
        this.running = false;

    }

    add(photo) {

        this.queue.push(photo);

    }

    next() {

        return this.queue.shift();

    }

    clear() {

        this.queue = [];

    }

    size() {

        return this.queue.length;

    }

}

export default new ThumbnailQueue();