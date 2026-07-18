import AlbumAnalyzer from "../album/AlbumAnalyzer";
import AlbumSelector from "../album/AlbumSelector";
import AlbumComposer from "../album/AlbumComposer";
import PSDExporter from "../album/PSDExporter";

class AlbumEngine {

    constructor() {

        this.project = null;
        this.analysis = null;
        this.album = null;

        this.building = false;

    }

    async build(project, options = {}) {

        if (!project)
            throw new Error("Project is required.");

        if (this.building)
            throw new Error("Album build already running.");

        this.building = true;

        try {

            this.project = project;

            // Step 1 : AI / Photo Analysis

            this.analysis =
                await AlbumAnalyzer.analyze(project);

            // Step 2 : Layout Selection

            await AlbumSelector.select(
                project,
                options
            );

            // Step 3 : Compose Album

            this.album =
                await AlbumComposer.compose(
                    project
                );

            return this.album;

        }

        finally {

            this.building = false;

        }

    }

    async rebuild(options = {}) {

        if (!this.project)
            throw new Error("No active project.");

        this.analysis = null;
        this.album = null;

        return this.build(
            this.project,
            options
        );

    }

    async export(options = {}) {

        if (!this.album)
            throw new Error("No album generated.");

        return PSDExporter.export(
            this.album,
            options
        );

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

    isBuilding() {

        return this.building;

    }

    hasAlbum() {

        return this.album !== null;

    }

    clear() {

        this.project = null;
        this.analysis = null;
        this.album = null;
        this.building = false;

    }

    status() {

        return {

            building: this.building,

            projectLoaded: !!this.project,

            analyzed: !!this.analysis,

            albumGenerated: !!this.album,

            pages:
                this.album?.totalPages ??
                this.album?.pages?.length ??
                0,

            photos:
                this.project?.getPhotoCount?.() ??
                this.project?.photos?.length ??
                0

        };

    }

}

export default new AlbumEngine();