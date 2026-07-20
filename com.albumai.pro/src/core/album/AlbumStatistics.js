import Logger from "../photoshop/Logger";

export default class AlbumStatistics {

    constructor() {

        this.reset();

    }

    reset() {

        this.stats = {

            albumsGenerated: 0,

            pagesGenerated: 0,

            photosPlaced: 0,

            photosSkipped: 0,

            templatesLoaded: 0,

            templatesValidated: 0,

            exportCount: 0,

            failedExports: 0,

            processingTime: 0,

            startedAt: null,

            finishedAt: null

        };

    }

    start() {

        this.stats.startedAt = new Date();

    }

    finish() {

        this.stats.finishedAt = new Date();

        if (this.stats.startedAt) {

            this.stats.processingTime =

                this.stats.finishedAt -

                this.stats.startedAt;

        }

        Logger.info(

            "Album statistics finalized."

        );

    }

    increment(key, amount = 1) {

        if (!(key in this.stats)) {

            this.stats[key] = 0;

        }

        this.stats[key] += amount;

    }

    set(key, value) {

        this.stats[key] = value;

    }

    get(key, defaultValue = 0) {

        return Object.prototype.hasOwnProperty.call(

            this.stats,

            key

        )

            ? this.stats[key]

            : defaultValue;

    }

    update(values = {}) {

        Object.assign(

            this.stats,

            values

        );

    }

    export() {

        return {

            ...this.stats

        };

    }

}