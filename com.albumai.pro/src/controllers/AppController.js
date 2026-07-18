import AlbumAIPro from "../index";

import MainController from "./MainController";
import FolderController from "./FolderController";
import PhotoController from "./PhotoController";
import TemplateController from "./TemplateController";
import AlbumController from "./AlbumController";
import ExportController from "./ExportController";

class AppController {

    constructor() {

        this.initialized = false;

    }

    async initialize() {

        if (this.initialized)
            return true;

        await MainController.initialize();

        this.registerEvents();

        this.initialized = true;

        AlbumAIPro.core.state.set(
            "initialized",
            true
        );

        AlbumAIPro.core.events.emit(
            "app:initialized"
        );

        return true;

    }

    registerEvents() {

        AlbumAIPro.core.events.on(

            "folder:opened",

            photos => {

                PhotoController.setPhotos(

                    photos.photos

                );

            }

        );

    }

    async openFolder(folder) {

        return FolderController.open(

            folder

        );

    }

    async createProject(data) {

        return MainController.createProject(

            data

        );

    }

    async generateAlbum(options = {}) {

        const project = MainController.getProject();

        return AlbumController.autoGenerate(

            project,

            options

        );

    }

    async exportAlbum(format = "psd", options = {}) {

        const album = AlbumController.getAlbum();

        switch (format.toLowerCase()) {

            case "jpg":
            case "jpeg":

                return ExportController.exportJPEG(

                    album,

                    options

                );

            case "png":

                return ExportController.exportPNG(

                    album,

                    options

                );

            case "pdf":

                return ExportController.exportPDF(

                    album,

                    options

                );

            case "psd":
            default:

                return ExportController.exportPSD(

                    album,

                    options

                );

        }

    }

    getControllers() {

        return {

            main: MainController,

            folder: FolderController,

            photo: PhotoController,

            template: TemplateController,

            album: AlbumController,

            export: ExportController

        };

    }

    reset() {

        FolderController.clear();

        PhotoController.clear();

        TemplateController.clear();

        AlbumController.reset();

        MainController.reset();

        AlbumAIPro.core.state.reset();

        AlbumAIPro.core.events.emit(

            "app:reset"

        );

    }

    async shutdown() {

        this.reset();

        await AlbumAIPro.shutdown();

        this.initialized = false;

    }

}

export default new AppController();