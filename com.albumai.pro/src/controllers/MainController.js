import AlbumAIPro from "../index";

class MainController {

    constructor() {

        this.project = null;
        this.initialized = false;

    }

    async initialize() {

        if (this.initialized) {
            return true;
        }

        await AlbumAIPro.initialize();

        this.initialized = true;

        return true;

    }

    async createProject({

        name,
        folder,
        photos = [],
        template = null

    }) {

        this.project =
            await AlbumAIPro.engines.workflow.createProject({

                name,
                folder,
                photos,
                template

            });

        AlbumAIPro.core.state.set(
            "project",
            this.project
        );

        AlbumAIPro.core.events.emit(
            "project:created",
            this.project
        );

        return this.project;

    }

    async generate(options = {}) {

        if (!this.project) {
            throw new Error("No active project.");
        }

        const album =
            await AlbumAIPro.engines.workflow.run(options);

        AlbumAIPro.core.state.set(
            "album",
            album
        );

        AlbumAIPro.core.events.emit(
            "album:generated",
            album
        );

        return album;

    }

    async analyze() {

        if (!this.project) {
            throw new Error("No active project.");
        }

        return AlbumAIPro.engines.ai.analyze(
            this.project.photos
        );

    }

    async export(options = {}) {

        const album = this.getAlbum();

        if (!album) {
            throw new Error("Album not generated.");
        }

        return AlbumAIPro.engines.export.export(
            album,
            options
        );

    }

    openTemplate(template) {

        if (!this.project) {
            throw new Error("No active project.");
        }

        this.project.setTemplate(template);

        AlbumAIPro.core.state.set(
            "template",
            template
        );

        AlbumAIPro.core.events.emit(
            "template:selected",
            template
        );

        return template;

    }

    selectPhotos(photos = []) {

        if (!this.project) {
            throw new Error("No active project.");
        }

        this.project.setSelectedPhotos(photos);

        AlbumAIPro.core.state.set(
            "selectedPhotos",
            photos
        );

        AlbumAIPro.core.events.emit(
            "photos:selected",
            photos
        );

        return photos;

    }

    getProject() {

        return this.project;

    }

    hasProject() {

        return this.project !== null;

    }

    getAlbum() {

        return AlbumAIPro.core.state.get("album");

    }

    reset() {

        this.project = null;
        this.initialized = false;

        AlbumAIPro.core.state.reset();

        AlbumAIPro.core.events.emit(
            "project:reset"
        );

    }

}

export default new MainController();