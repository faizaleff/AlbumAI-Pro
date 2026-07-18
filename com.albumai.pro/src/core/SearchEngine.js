export default class SearchEngine {

    constructor(library) {

        this.library = library;

    }

    search(keyword) {

        if (!keyword) {

            return this.library.getPhotos();

        }

        const value = keyword.toLowerCase();

        return this.library.getPhotos().filter(photo => {

            return photo.name.toLowerCase().includes(value);

        });

    }

}