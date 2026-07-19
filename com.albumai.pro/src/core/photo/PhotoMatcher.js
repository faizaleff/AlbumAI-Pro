// src/core/photo/PhotoMatcher.js

import {
    PhotoOrientation,
    PlaceholderType,
    PhotoStatus
} from "./PhotoTypes";

class PhotoMatcher {

    constructor({
        filter,
        sorter
    } = {}) {

        this.filter = filter;
        this.sorter = sorter;

    }

    /**
     * Match photos to placeholders.
     * @param {Array<Object>} photos
     * @param {Array<Object>} placeholders
     * @returns {Array<Object>}
     */
    match(photos = [], placeholders = []) {

        const available = [...photos];
        const assignments = [];

        for (const placeholder of placeholders) {

            const photo = this.findBestMatch(
                available,
                placeholder
            );

            if (!photo)
                continue;

            photo.status = PhotoStatus.MATCHED;

            assignments.push({

                placeholderId: placeholder.id,

                placeholder,

                photoId: photo.id,

                photo

            });

            const index = available.findIndex(
                p => p.id === photo.id
            );

            if (index >= 0) {

                available.splice(index, 1);

            }

        }

        return assignments;

    }

    /**
     * Select best photo.
     */
    findBestMatch(
        photos,
        placeholder
    ) {

        let candidates = [...photos];

        candidates = this.filterDuplicates(
            candidates
        );

        candidates = this.filterOrientation(
            candidates,
            placeholder
        );

        candidates = this.sortCandidates(
            candidates
        );

        return candidates[0] ?? null;

    }

    /**
     * Ignore duplicates.
     */
    filterDuplicates(photos) {

        return photos.filter(
            p => !p.duplicate
        );

    }

    /**
     * Match orientation.
     */
    filterOrientation(
        photos,
        placeholder
    ) {

        switch (placeholder.type) {

            case PlaceholderType.COVER:

                return photos.filter(
                    p =>
                        p.orientation ===
                        PhotoOrientation.PORTRAIT
                );

            case PlaceholderType.FULL_PAGE:

                return photos;

            case PlaceholderType.HALF_PAGE:

                return photos;

            case PlaceholderType.SQUARE:

                return photos.filter(
                    p =>
                        p.orientation ===
                        PhotoOrientation.SQUARE
                );

            default:

                return photos;

        }

    }

    /**
     * Rank candidates.
     */
    sortCandidates(photos) {

        return [...photos].sort(
            (a, b) => {

                const ratingA =
                    a.metadata?.rating ?? 0;

                const ratingB =
                    b.metadata?.rating ?? 0;

                if (ratingA !== ratingB) {

                    return ratingB - ratingA;

                }

                const facesA =
                    a.analysis?.faceCount ?? 0;

                const facesB =
                    b.analysis?.faceCount ?? 0;

                if (facesA !== facesB) {

                    return facesB - facesA;

                }

                const quality = {

                    excellent: 4,

                    high: 3,

                    medium: 2,

                    low: 1

                };

                return (

                    (quality[
                        b.analysis?.quality
                    ] ?? 0)

                    -

                    (quality[
                        a.analysis?.quality
                    ] ?? 0)

                );

            }

        );

    }

}

export default PhotoMatcher;