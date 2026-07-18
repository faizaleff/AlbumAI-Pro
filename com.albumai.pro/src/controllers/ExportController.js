import AlbumAIPro from "../index";

class ExportController {

    constructor() {

        this.lastExport = null;

    }

    async exportPSD(album, options = {}) {

        const result = await AlbumAIPro.engines.export.exportPSD(

            album,

            options

        );

        this.lastExport = result;

        AlbumAIPro.core.events.emit(

            "export:psd",

            result

        );

        return result;

    }

    async exportJPEG(album, options = {}) {

        const result = await AlbumAIPro.engines.export.exportJPEG(

            album,

            options

        );

        this.lastExport = result;

        AlbumAIPro.core.events.emit(

            "export:jpeg",

            result

        );

        return result;

    }

    async exportPNG(album, options = {}) {

        const result = await AlbumAIPro.engines.export.exportPNG(

            album,

            options

        );

        this.lastExport = result;

        AlbumAIPro.core.events.emit(

            "export:png",

            result

        );

        return result;

    }

    async exportPDF(album, options = {}) {

        const result = await AlbumAIPro.engines.export.exportPDF(

            album,

            options

        );

        this.lastExport = result;

        AlbumAIPro.core.events.emit(

            "export:pdf",

            result

        );

        return result;

    }

    async exportAll(album, options = {}) {

        const result = await AlbumAIPro.engines.export.exportAll(

            album,

            options

        );

        this.lastExport = result;

        AlbumAIPro.core.events.emit(

            "export:complete",

            result

        );

        return result;

    }

    getLastExport() {

        return this.lastExport;

    }

    clearHistory() {

        this.lastExport = null;

        AlbumAIPro.core.events.emit(

            "export:history:cleared"

        );

    }

    isExporting() {

        return AlbumAIPro.core.state.get(

            "exporting"

        ) || false;

    }

    setExporting(status) {

        AlbumAIPro.core.state.set(

            "exporting",

            status

        );

        AlbumAIPro.core.events.emit(

            "export:status",

            status

        );

    }

}

export default new ExportController();