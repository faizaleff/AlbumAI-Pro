import AlbumBootstrap from "./engine/AlbumBootstrap";

import WorkflowEngine from "./engine/WorkflowEngine";
import AutoAlbumEngine from "./engine/AutoAlbumEngine";
import AlbumEngine from "./engine/AlbumEngine";
import AlbumAIEngine from "./engine/AlbumAIEngine";
import AlbumRenderEngine from "./engine/AlbumRenderEngine";
import AlbumExportEngine from "./engine/AlbumExportEngine";

import AlbumStateManager from "./engine/AlbumStateManager";
import AlbumEventBus from "./engine/AlbumEventBus";
import AlbumCommandManager from "./engine/AlbumCommandManager";
import AlbumPluginManager from "./engine/AlbumPluginManager";

import TemplateManager from "./templates/TemplateManager";
import TemplateLoader from "./templates/TemplateLoader";
import TemplateLibrary from "./templates/TemplateLibrary";

import ThumbnailService from "./services/ThumbnailService";
import MetadataService from "./services/MetadataService";
import SelectionService from "./services/SelectionService";
import SearchService from "./services/SearchService";
import FaceIndexService from "./services/FaceIndexService";

import AlbumProject from "./album/AlbumProject";
import PSDTemplate from "./album/PSDTemplate";

class AlbumAI {

    async initialize() {

        await AlbumBootstrap.initialize();

        return this;

    }

    shutdown() {

        return AlbumBootstrap.shutdown();

    }

    get services() {

        return {

            thumbnails: ThumbnailService,

            metadata: MetadataService,

            selection: SelectionService,

            search: SearchService,

            faces: FaceIndexService

        };

    }

    get engines() {

        return {

            workflow: WorkflowEngine,

            autoAlbum: AutoAlbumEngine,

            album: AlbumEngine,

            ai: AlbumAIEngine,

            render: AlbumRenderEngine,

            export: AlbumExportEngine

        };

    }

    get templates() {

        return {

            manager: TemplateManager,

            loader: TemplateLoader,

            library: TemplateLibrary

        };

    }

    get core() {

        return {

            events: AlbumEventBus,

            state: AlbumStateManager,

            commands: AlbumCommandManager,

            plugins: AlbumPluginManager

        };

    }

    createProject() {

        return new AlbumProject();

    }

    createTemplate(data) {

        return new PSDTemplate(data);

    }

    health() {

        return AlbumBootstrap.health();

    }

}

const AlbumAIPro = new AlbumAI();

export default AlbumAIPro;

export {

    AlbumBootstrap,

    WorkflowEngine,
    AutoAlbumEngine,
    AlbumEngine,
    AlbumAIEngine,
    AlbumRenderEngine,
    AlbumExportEngine,

    AlbumStateManager,
    AlbumEventBus,
    AlbumCommandManager,
    AlbumPluginManager,

    TemplateManager,
    TemplateLoader,
    TemplateLibrary,

    ThumbnailService,
    MetadataService,
    SelectionService,
    SearchService,
    FaceIndexService,

    AlbumProject,
    PSDTemplate

};