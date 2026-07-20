import Logger from "../core/photoshop/Logger";

export default class StatisticsService {

    constructor() {

        this.reset();

    }

    reset() {

        this.stats = {

            albums: 0,

            sheets: 0,

            photos: 0,

            exports: 0,

            success: 0,

            failed: 0,

            startedAt: null,

            finishedAt: null

        };

    }

    start() {

        this.stats.startedAt =
            new Date();

    }

    finish() {

        this.stats.finishedAt =
            new Date();

    }

    increment(key, amount = 1) {

        if (!(key in this.stats))
            return;

        this.stats[key] += amount;

    }

    success() {

        this.increment("success");

    }

    failed() {

        this.increment("failed");

    }

    album() {

        this.increment("albums");

    }

    sheet() {

        this.increment("sheets");

    }

    photo(count = 1) {

        this.increment("photos", count);

    }

    export() {

        this.increment("exports");

    }

    duration() {

        if (
            !this.stats.startedAt ||
            !this.stats.finishedAt
        )
            return 0;

        return (
            this.stats.finishedAt -
            this.stats.startedAt
        );

    }

    summary() {

        const summary = {

            ...this.stats,

            duration: this.duration()

        };

        Logger.info(summary);

        return summary;

    }

}