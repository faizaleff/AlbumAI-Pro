import AlbumAnalyzer from "../album/AlbumAnalyzer";
import AlbumSelector from "../album/AlbumSelector";
import AlbumComposer from "../album/AlbumComposer";
import PSDExporter from "../album/PSDExporter";

class AlbumEngine {

    constructor() {

        this.project = null;

        this.analysis = null;

        this.album = null;

    }

    async build(project, options = {}) {

        if (!project)
            throw new Error("Project is required.");

        this.project = project;

        this.analysis =
            await AlbumAnalyzer.analyze(project);

        await AlbumSelector.select(project, options);

        this.album =
            AlbumComposer.compose(project);

        return this.album;

    }

    async export() {

        if (!this.album)
            throw new Error("No album generated.");

        await PSDExporter.export(this.album);

    }

    getAlbum() {

        return this.album;

    }

    getAnalysis() {

        return this.analysis;

    }

    getProject() {

        return this.project;

    }

    clear() {

        this.project = null;

        this.analysis = null;

        this.album = null;

    }

    async rebuild(options = {}) {

        if (!this.project)
            throw new Error("No active project.");

        return this.build(this.project, options);

    }

    status() {

        return {

            projectLoaded: !!this.project,

            analyzed: !!this.analysis,

            albumGenerated: !!this.album,

            pages: this.album
                ? this.album.totalPages
                : 0,

            photos: this.project
                ? this.project.getPhotoCount()
                : 0

        };

    }

}

export default new AlbumEngine();