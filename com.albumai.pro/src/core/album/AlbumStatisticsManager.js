import Logger from "../photoshop/Logger";
import AlbumStatistics from "./AlbumStatistics";

export default class AlbumStatisticsManager {

    constructor() {

        this.statistics =
            new AlbumStatistics();

    }

    start() {

        this.statistics.start();

        Logger.info(
            "Statistics collection started."
        );

    }

    finish() {

        this.statistics.finish();

        Logger.info(
            "Statistics collection completed."
        );

        return this.statistics.export();

    }

    increment(key, amount = 1) {

        this.statistics.increment(

            key,

            amount

        );

    }

    set(key, value) {

        this.statistics.set(

            key,

            value

        );

    }

    get(key, defaultValue = 0) {

        return this.statistics.get(

            key,

            defaultValue

        );

    }

    update(values = {}) {

        this.statistics.update(values);

    }

    export() {

        return this.statistics.export();

    }

    reset() {

        this.statistics.reset();

        Logger.info(
            "Statistics reset."
        );

    }

    albumGenerated() {

        this.increment(
            "albumsGenerated"
        );

    }

    pageGenerated(count = 1) {

        this.increment(
            "pagesGenerated",
            count
        );

    }

    photoPlaced(count = 1) {

        this.increment(
            "photosPlaced",
            count
        );

    }

    photoSkipped(count = 1) {

        this.increment(
            "photosSkipped",
            count
        );

    }

    templateLoaded() {

        this.increment(
            "templatesLoaded"
        );

    }

    templateValidated() {

        this.increment(
            "templatesValidated"
        );

    }

    exportSucceeded() {

        this.increment(
            "exportCount"
        );

    }

    exportFailed() {

        this.increment(
            "failedExports"
        );

    }

}