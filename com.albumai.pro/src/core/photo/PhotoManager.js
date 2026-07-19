// src/core/photo/PhotoManager.js

class PhotoManager {

    constructor({

        collection,
        scanner,
        metadata,
        orientation,
        analyzer,
        duplicate,
        filter,
        sorter,
        cache,
        matcher

    }) {

        this.collection = collection;
        this.scanner = scanner;
        this.metadata = metadata;
        this.orientation = orientation;
        this.analyzer = analyzer;
        this.duplicate = duplicate;
        this.filter = filter;
        this.sorter = sorter;
        this.cache = cache;
        this.matcher = matcher;

    }

    /**
     * Import a wedding folder.
     */
    async import(folder) {

        await this.scanner.scan(folder);

        const photos = this.collection.all();

        await this.metadata.readMany(photos);

        this.orientation.determineMany(photos);

        await this.analyzer.analyzeMany(photos);

        await this.duplicate.find(photos);

        return photos;

    }

    /**
     * Match photos to placeholders.
     */
    async createAssignments(placeholders) {

        return this.matcher.match(

            this.collection.all(),

            placeholders

        );

    }

    /**
     * Get all photos.
     */
    getPhotos() {

        return this.collection.all();

    }

    /**
     * Statistics.
     */
    getStatistics() {

        return this.collection.stats();

    }

    /**
     * Clear project.
     */
    clear() {

        this.collection.clear();

        this.cache.clear();

    }

}
export default PhotoManager;