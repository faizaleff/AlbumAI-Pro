// src/core/photo/PhotoFilter.js

import {
    PhotoOrientation,
    PhotoQuality,
    PhotoStatus
} from "./PhotoTypes";

class PhotoFilter {

    /**
     * Filter by orientation.
     */
    byOrientation(photos = [], orientation) {

        return photos.filter(
            photo => photo.orientation === orientation
        );

    }

    portrait(photos = []) {

        return this.byOrientation(
            photos,
            PhotoOrientation.PORTRAIT
        );

    }

    landscape(photos = []) {

        return this.byOrientation(
            photos,
            PhotoOrientation.LANDSCAPE
        );

    }

    square(photos = []) {

        return this.byOrientation(
            photos,
            PhotoOrientation.SQUARE
        );

    }

    panorama(photos = []) {

        return this.byOrientation(
            photos,
            PhotoOrientation.PANORAMA
        );

    }

    /**
     * Filter by quality.
     */
    byQuality(photos = [], quality) {

        return photos.filter(
            photo => photo.analysis?.quality === quality
        );

    }

    excellent(photos = []) {

        return this.byQuality(
            photos,
            PhotoQuality.EXCELLENT
        );

    }

    high(photos = []) {

        return this.byQuality(
            photos,
            PhotoQuality.HIGH
        );

    }

    /**
     * Filter by rating.
     */
    byRating(photos = [], minimumRating) {

        return photos.filter(
            photo =>
                (photo.metadata?.rating ?? 0) >= minimumRating
        );

    }

    /**
     * Filter by status.
     */
    byStatus(photos = [], status) {

        return photos.filter(
            photo => photo.status === status
        );

    }

    unused(photos = []) {

        return photos.filter(
            photo =>
                photo.status !== PhotoStatus.USED
        );

    }

    used(photos = []) {

        return this.byStatus(
            photos,
            PhotoStatus.USED
        );

    }

    /**
     * Duplicate filters.
     */
    duplicates(photos = []) {

        return photos.filter(
            photo => photo.duplicate === true
        );

    }

    unique(photos = []) {

        return photos.filter(
            photo => !photo.duplicate
        );

    }

    /**
     * Face count.
     */
    withFaces(photos = [], minimum = 1) {

        return photos.filter(
            photo =>
                (photo.analysis?.faceCount ?? 0) >= minimum
        );

    }

    /**
     * Resolution.
     */
    minimumResolution(
        photos = [],
        width,
        height
    ) {

        return photos.filter(photo => {

            const w =
                photo.analysis?.width ??
                photo.metadata?.width;

            const h =
                photo.analysis?.height ??
                photo.metadata?.height;

            return w >= width && h >= height;

        });

    }

    /**
     * Custom filter.
     */
    where(photos = [], predicate) {

        return photos.filter(predicate);

    }

}

export default PhotoFilter;