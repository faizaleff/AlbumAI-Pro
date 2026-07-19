// src/core/photo/PhotoOrientation.js

import { PhotoOrientation as Orientation } from "./PhotoTypes";

class PhotoOrientation {

    /**
     * Determine orientation from dimensions.
     * @param {Object} photo
     * @returns {string}
     */
    determine(photo) {

        this.validate(photo);

        const width =
            photo.metadata?.width ?? photo.width;

        const height =
            photo.metadata?.height ?? photo.height;

        if (!width || !height)
            return Orientation.UNKNOWN;

        const ratio = width / height;

        let orientation;

        if (ratio > 2.5) {

            orientation = Orientation.PANORAMA;

        } else if (Math.abs(width - height) <= 10) {

            orientation = Orientation.SQUARE;

        } else if (width > height) {

            orientation = Orientation.LANDSCAPE;

        } else {

            orientation = Orientation.PORTRAIT;

        }

        photo.orientation = orientation;

        return orientation;

    }

    /**
     * Determine orientations for multiple photos.
     * @param {Array<Object>} photos
     */
    determineMany(photos = []) {

        for (const photo of photos) {

            this.determine(photo);

        }

        return photos;

    }

    /**
     * Helper methods.
     */

    isPortrait(photo) {

        return photo.orientation === Orientation.PORTRAIT;

    }

    isLandscape(photo) {

        return photo.orientation === Orientation.LANDSCAPE;

    }

    isSquare(photo) {

        return photo.orientation === Orientation.SQUARE;

    }

    isPanorama(photo) {

        return photo.orientation === Orientation.PANORAMA;

    }

    validate(photo) {

        if (!photo) {

            throw new Error(
                "Photo is required."
            );

        }

    }

}

export default PhotoOrientation;