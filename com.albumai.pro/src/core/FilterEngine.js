export default class FilterEngine {

    constructor(library) {

        this.library = library;

    }

    favorites() {

        return this.library
            .getPhotos()
            .filter(photo => photo.favorite);

    }

    rating(value) {

        return this.library
            .getPhotos()
            .filter(photo => photo.rating >= value);

    }

    aiScore(score) {

        return this.library
            .getPhotos()
            .filter(photo => photo.aiScore >= score);

    }

}