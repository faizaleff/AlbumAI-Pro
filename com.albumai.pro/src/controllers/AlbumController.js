import AlbumAIPro from "../index";

class AlbumController {

    constructor() {

        this.album = null;
        this.generating = false;

    }

    async create(project, options = {}) {

        if (!project) {
            throw new Error("Project is required.");
        }

        this.album = await AlbumAIPro.engines.album.create(
            project,
            options
        );

        this.updateState("album:created");

        return this.album;

    }

    async autoGenerate(project, options = {}) {

        if (!project) {
            throw new Error("Project is required.");
        }

        if (this.generating) {
            throw new Error("Album generation already in progress.");
        }

        this.generating = true;

        AlbumAIPro.core.events.emit(
            "album:generationStarted"
        );

        try {

            this.album =
                await AlbumAIPro.engines.autoAlbum.generate(
                    project,
                    options
                );

            this.updateState("album:generated");

            return this.album;

        } finally {

            this.generating = false;

            AlbumAIPro.core.events.emit(
                "album:generationFinished"
            );

        }

    }

    async render(options = {}) {

        if (!this.album) {
            throw new Error("No active album.");
        }

        return AlbumAIPro.engines.render.render(
            this.album,
            options
        );

    }

    async export(options = {}) {

        if (!this.album) {
            throw new Error("No active album.");
        }

        return AlbumAIPro.engines.export.export(
            this.album,
            options
        );

    }

    getAlbum() {

        return this.album;

    }

    hasAlbum() {

        return this.album !== null;

    }

    isGenerating() {

        return this.generating;

    }

    getPages() {

        return this.album?.pages ?? [];

    }

    page(index) {

        return this.album?.pages?.[index] ?? null;

    }

    pageCount() {

        return this.album?.pages?.length ?? 0;

    }

    statistics() {

        if (!this.album) {
            return null;
        }

        return AlbumAIPro.engines.album.statistics(
            this.album
        );

    }

    save() {

        if (!this.album) {
            throw new Error("No active album.");
        }

        return AlbumAIPro.engines.album.save(
            this.album
        );

    }

    load(album) {

        this.album = album;

        this.updateState("album:loaded");

        return album;

    }

    close() {

        this.album = null;

        AlbumAIPro.core.state.set(
            "album",
            null
        );

        AlbumAIPro.core.events.emit(
            "album:closed"
        );

    }

    reset() {

        this.generating = false;

        this.close();

    }

    updateState(eventName) {

        AlbumAIPro.core.state.set(
            "album",
            this.album
        );

        AlbumAIPro.core.events.emit(
            eventName,
            this.album
        );

    }

}

export default new AlbumController();