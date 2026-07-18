import AlbumAIPro from "../index";

class MainController {

    constructor() {

        this.project = null;

    }

    async initialize() {

        await AlbumAIPro.initialize();

        return true;

    }

    async createProject({

        name,

        folder,

        photos,

        template

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

        if (!this.project)
            throw new Error("No active project.");

        const album =

            await AlbumAIPro.engines.workflow.run(

                options

            );

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

        if (!this.project)
            throw new Error("No active project.");

        return AlbumAIPro.engines.ai.analyze(

            this.project.photos

        );

    }

    async export(options = {}) {

        const album =

            AlbumAIPro.core.state.get("album");

        if (!album)
            throw new Error("Album not generated.");

        return AlbumAIPro.engines.export.export(

            album,

            options

        );

    }

    openTemplate(template) {

        this.project.setTemplate(template);

        AlbumAIPro.core.events.emit(

            "template:selected",

            template

        );

    }

    selectPhotos(photos) {

        this.project.setSelectedPhotos(photos);

        AlbumAIPro.core.events.emit(

            "photos:selected",

            photos

        );

    }

    getProject() {

        return this.project;

    }

    getAlbum() {

        return AlbumAIPro.core.state.get("album");

    }

    reset() {

        this.project = null;

        AlbumAIPro.core.state.reset();

    }

}

export default new MainController();