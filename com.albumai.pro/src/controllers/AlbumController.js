import AlbumAIPro from "../index";

class AlbumController {

    constructor() {

        this.album = null;

    }

    async create(project, options = {}) {

        this.album = await AlbumAIPro.engines.album.create(

            project,

            options

        );

        AlbumAIPro.core.state.set(

            "album",

            this.album

        );

        AlbumAIPro.core.events.emit(

            "album:created",

            this.album

        );

        return this.album;

    }

    async autoGenerate(project, options = {}) {

        this.album = await AlbumAIPro.engines.autoAlbum.generate(

            project,

            options

        );

        AlbumAIPro.core.state.set(

            "album",

            this.album

        );

        AlbumAIPro.core.events.emit(

            "album:generated",

            this.album

        );

        return this.album;

    }

    async render(options = {}) {

        if (!this.album)
            throw new Error("No active album.");

        return AlbumAIPro.engines.render.render(

            this.album,

            options

        );

    }

    async export(options = {}) {

        if (!this.album)
            throw new Error("No active album.");

        return AlbumAIPro.engines.export.export(

            this.album,

            options

        );

    }

    getAlbum() {

        return this.album;

    }

    getPages() {

        return this.album?.pages || [];

    }

    page(index) {

        return this.album?.pages?.[index] || null;

    }

    pageCount() {

        return this.album?.pages?.length || 0;

    }

    statistics() {

        if (!this.album)
            return null;

        return AlbumAIPro.engines.album.statistics(

            this.album

        );

    }

    save() {

        if (!this.album)
            throw new Error("No active album.");

        return AlbumAIPro.engines.album.save(

            this.album

        );

    }

    load(album) {

        this.album = album;

        AlbumAIPro.core.state.set(

            "album",

            album

        );

        AlbumAIPro.core.events.emit(

            "album:loaded",

            album

        );

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

        this.close();

    }

}

export default new AlbumController();