export default class BalancedOrientationStrategy {

    constructor({
        squareTolerance = 0.05,
        orientationMatchScore = 100,
        aspectRatioScore = 50,
        reusePenalty = 1000
    } = {}) {

        this.squareTolerance = squareTolerance;
        this.orientationMatchScore = orientationMatchScore;
        this.aspectRatioScore = aspectRatioScore;
        this.reusePenalty = reusePenalty;

    }

    classify(width, height) {

        if (!this.validDimension(width) || !this.validDimension(height)) {
            return "unknown";
        }

        const ratio = width / height;

        if (Math.abs(ratio - 1) <= this.squareTolerance) {
            return "square";
        }

        return ratio > 1 ? "landscape" : "portrait";

    }

    score(slot, photo, reused = false) {

        const orientationMatch =
            slot.orientation !== "unknown" &&
            slot.orientation === photo.orientation;
        const aspectDistance = this.aspectDistance(
            slot.aspectRatio,
            photo.aspectRatio
        );

        return (
            (orientationMatch ? this.orientationMatchScore : 0) +
            Math.max(0, this.aspectRatioScore - aspectDistance * this.aspectRatioScore) -
            (reused ? this.reusePenalty : 0)
        );

    }

    aspectDistance(slotAspectRatio, photoAspectRatio) {

        if (!this.validDimension(slotAspectRatio) || !this.validDimension(photoAspectRatio)) {
            return 1;
        }

        return Math.abs(Math.log(slotAspectRatio / photoAspectRatio));

    }

    validDimension(value) {

        return Number.isFinite(Number(value)) && Number(value) > 0;

    }

}
