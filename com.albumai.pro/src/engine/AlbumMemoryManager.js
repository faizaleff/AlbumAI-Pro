class AlbumMemoryManager {

    constructor(maxMemoryMB = 512) {

        this.maxMemoryMB = maxMemoryMB;

        this.items = new Map();

        this.currentMemoryMB = 0;

    }

    set(key, value, sizeMB = 1) {

        if (this.items.has(key)) {

            this.currentMemoryMB -= this.items.get(key).sizeMB;

            this.items.delete(key);

        }

        while (

            this.currentMemoryMB + sizeMB >

            this.maxMemoryMB &&

            this.items.size

        ) {

            this.evict();

        }

        this.items.set(key, {

            value,

            sizeMB,

            lastAccess: Date.now()

        });

        this.currentMemoryMB += sizeMB;

    }

    get(key) {

        const item = this.items.get(key);

        if (!item)
            return null;

        item.lastAccess = Date.now();

        return item.value;

    }

    has(key) {

        return this.items.has(key);

    }

    remove(key) {

        const item = this.items.get(key);

        if (!item)
            return false;

        this.currentMemoryMB -= item.sizeMB;

        this.items.delete(key);

        return true;

    }

    clear() {

        this.items.clear();

        this.currentMemoryMB = 0;

    }

    evict() {

        let oldestKey = null;

        let oldestTime = Infinity;

        for (const [key, item] of this.items) {

            if (item.lastAccess < oldestTime) {

                oldestTime = item.lastAccess;

                oldestKey = key;

            }

        }

        if (oldestKey !== null)
            this.remove(oldestKey);

    }

    keys() {

        return [...this.items.keys()];

    }

    values() {

        return [...this.items.values()].map(

            item => item.value

        );

    }

    size() {

        return this.items.size;

    }

    memoryUsed() {

        return this.currentMemoryMB;

    }

    memoryFree() {

        return Math.max(

            0,

            this.maxMemoryMB - this.currentMemoryMB

        );

    }

    usagePercent() {

        return Number(

            (

                this.currentMemoryMB /

                this.maxMemoryMB *

                100

            ).toFixed(2)

        );

    }

    statistics() {

        return {

            items: this.size(),

            usedMB: this.memoryUsed(),

            freeMB: this.memoryFree(),

            maxMB: this.maxMemoryMB,

            usage: this.usagePercent()

        };

    }

}

export default new AlbumMemoryManager();