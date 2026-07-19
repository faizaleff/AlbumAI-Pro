// src/core/photo/PhotoSorter.js

import { SortField, SortOrder } from "./PhotoTypes";

class PhotoSorter {

    /**
     * Generic sort.
     * @param {Array<Object>} photos
     * @param {string} field
     * @param {string} order
     */
    byField(
        photos = [],
        field,
        order = SortOrder.ASC
    ) {

        const sorted = [...photos];

        sorted.sort((a, b) => {

            const valueA = this.value(a, field);
            const valueB = this.value(b, field);

            if (valueA == null && valueB == null)
                return 0;

            if (valueA == null)
                return 1;

            if (valueB == null)
                return -1;

            if (valueA < valueB)
                return order === SortOrder.ASC ? -1 : 1;

            if (valueA > valueB)
                return order === SortOrder.ASC ? 1 : -1;

            return 0;

        });

        return sorted;

    }

    byName(
        photos = [],
        order = SortOrder.ASC
    ) {

        return this.byField(
            photos,
            SortField.NAME,
            order
        );

    }

    byDate(
        photos = [],
        order = SortOrder.ASC
    ) {

        return this.byField(
            photos,
            SortField.DATE,
            order
        );

    }

    byRating(
        photos = [],
        order = SortOrder.DESC
    ) {

        return this.byField(
            photos,
            SortField.RATING,
            order
        );

    }

    byQuality(
        photos = [],
        order = SortOrder.DESC
    ) {

        return this.byField(
            photos,
            SortField.QUALITY,
            order
        );

    }

    byResolution(
        photos = [],
        order = SortOrder.DESC
    ) {

        const sorted = [...photos];

        sorted.sort((a, b) => {

            const pixelsA =
                (a.analysis?.width ?? a.metadata?.width ?? 0) *
                (a.analysis?.height ?? a.metadata?.height ?? 0);

            const pixelsB =
                (b.analysis?.width ?? b.metadata?.width ?? 0) *
                (b.analysis?.height ?? b.metadata?.height ?? 0);

            return order === SortOrder.ASC
                ? pixelsA - pixelsB
                : pixelsB - pixelsA;

        });

        return sorted;

    }

    /**
     * Custom comparator.
     */
    custom(
        photos = [],
        comparator
    ) {

        const sorted = [...photos];

        sorted.sort(comparator);

        return sorted;

    }

    /**
     * Value resolver.
     */
    value(photo, field) {

        switch (field) {

            case SortField.NAME:
                return photo.name;

            case SortField.DATE:
                return photo.metadata?.captureDate;

            case SortField.RATING:
                return photo.metadata?.rating;

            case SortField.QUALITY:
                return photo.analysis?.quality;

            case SortField.WIDTH:
                return photo.analysis?.width ??
                       photo.metadata?.width;

            case SortField.HEIGHT:
                return photo.analysis?.height ??
                       photo.metadata?.height;

            case SortField.RESOLUTION:

                return (
                    (photo.analysis?.width ??
                        photo.metadata?.width ??
                        0) *
                    (photo.analysis?.height ??
                        photo.metadata?.height ??
                        0)
                );

            default:
                return photo[field];

        }

    }

}

export default PhotoSorter;