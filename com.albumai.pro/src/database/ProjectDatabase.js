export default class ProjectDatabase {

    constructor() {

        this.project = {

            name: "",

            folder: "",

            created: new Date(),

            photos: [],

            albums: [],

            templates: [],

            settings: {}

        };

    }

    setProject(name, folder) {

        this.project.name = name;
        this.project.folder = folder;

    }

    addPhoto(photo) {

        this.project.photos.push(photo);

    }

    getPhotos() {

        return this.project.photos;

    }

}