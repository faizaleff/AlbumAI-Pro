import DependencyContainer from "./DependencyContainer";

import AlbumEventBus from "../album/AlbumEventBus";

import ApplicationBootstrap from "./ApplicationBootstrap";

import AlbumProjectManager from "../album/AlbumProjectManager";
import AlbumGenerationEngine from "../album/AlbumGenerationEngine";
import AlbumSessionManager from "../album/AlbumSessionManager";
import AlbumQueueManager from "../album/AlbumQueueManager";
import AlbumRecoveryManager from "../album/AlbumRecoveryManager";
import AlbumAutosaveManager from "../album/AlbumAutosaveManager";
import AlbumProgressManager from "../album/AlbumProgressManager";
import AlbumValidationService from "../album/AlbumValidationService";
import AlbumSettingsManager from "../album/AlbumSettingsManager";
import AlbumPreferencesManager from "../album/AlbumPreferencesManager";
import AlbumCacheManager from "../album/AlbumCacheManager";
import ThumbnailManager from "../album/ThumbnailManager";

import ExportManager from "../export/ExportManager";
import AlbumExporter from "../export/AlbumExporter";
import PSDExporter from "../export/PSDExporter";
import BatchAlbumGenerator from "../export/BatchAlbumGenerator";

import FileSystemService from "../files/FileSystemService";
import FileTokenManager from "../files/FileTokenManager";

import PhotoshopAdapter from "../photoshop/PhotoshopAdapter";
import BatchPlayService from "../photoshop/BatchPlayService";
import DocumentManager from "../photoshop/DocumentManager";
import SmartObjectManager from "../photoshop/SmartObjectManager";
import LayerManager from "../photoshop/LayerManager";
import TextLayerManager from "../photoshop/TextLayerManager";
import SelectionManager from "../photoshop/SelectionManager";
import HistoryManager from "../photoshop/HistoryManager";
import DocumentScanner from "../photoshop/DocumentScanner";
import TemplateAnalyzer from "../photoshop/TemplateAnalyzer";
import PhotoSlotDetector from "../photoshop/PhotoSlotDetector";
import PhotoPlacementEngine from "../photoshop/PhotoPlacementEngine";
import ImageFitService from "../photoshop/ImageFitService";
import ImageTransformService from "../photoshop/ImageTransformService";
import PhotoReplacementPipeline from "../photoshop/PhotoReplacementPipeline";

import UIController from "../ui/UIController";
import UIStateStore from "../ui/UIStateStore";
import UIRouter from "../ui/UIRouter";
import PanelStateManager from "../ui/PanelStateManager";
import DialogManager from "../ui/DialogManager";
import NotificationManager from "../ui/NotificationManager";
import ShortcutManager from "../ui/ShortcutManager";
import DragDropManager from "../ui/DragDropManager";
import UICommandManager from "../ui/UICommandManager";
import StateSynchronizer from "../ui/StateSynchronizer";

export default class ServiceRegistry {

    constructor(container = new DependencyContainer()) {

        this.container = container;

    }

    registerAll() {

        this.registerCore();

        this.registerAlbum();

        this.registerPhotoshop();

        this.registerFiles();

        this.registerExport();

        this.registerUI();

        return this.container;

    }

    registerCore() {

        this.container.registerSingleton(

            "eventBus",

            () => new AlbumEventBus()

        );

        this.container.registerSingleton(

            "bootstrap",

            () => new ApplicationBootstrap()

        );

    }

    registerAlbum() {

        this.singleton("projectManager", AlbumProjectManager);
        this.singleton("albumEngine", AlbumGenerationEngine);
        this.singleton("sessionManager", AlbumSessionManager);
        this.singleton("queueManager", AlbumQueueManager);
        this.singleton("recoveryManager", AlbumRecoveryManager);
        this.singleton("autosaveManager", AlbumAutosaveManager);
        this.singleton("progressManager", AlbumProgressManager);
        this.singleton("validationService", AlbumValidationService);
        this.singleton("settingsManager", AlbumSettingsManager);
        this.singleton("preferencesManager", AlbumPreferencesManager);
        this.singleton("cacheManager", AlbumCacheManager);
        this.singleton("thumbnailManager", ThumbnailManager);

    }

    registerPhotoshop() {

        this.singleton("photoshopAdapter", PhotoshopAdapter);
        this.singleton("batchPlayService", BatchPlayService);
        this.singleton("documentManager", DocumentManager);
        this.singleton("smartObjectManager", SmartObjectManager);
        this.singleton("layerManager", LayerManager);
        this.singleton("textLayerManager", TextLayerManager);
        this.singleton("selectionManager", SelectionManager);
        this.singleton("historyManager", HistoryManager);
        this.singleton("documentScanner", DocumentScanner);
        this.singleton("templateAnalyzer", TemplateAnalyzer);
        this.singleton("photoSlotDetector", PhotoSlotDetector);
        this.singleton("photoPlacementEngine", PhotoPlacementEngine);
        this.singleton("imageFitService", ImageFitService);
        this.singleton("imageTransformService", ImageTransformService);
        this.singleton("photoReplacementPipeline", PhotoReplacementPipeline);

    }

    registerFiles() {

        this.singleton("fileSystemService", FileSystemService);
        this.singleton("fileTokenManager", FileTokenManager);

    }

    registerExport() {

        this.singleton("exportManager", ExportManager);
        this.singleton("albumExporter", AlbumExporter);
        this.singleton("psdExporter", PSDExporter);
        this.singleton("batchAlbumGenerator", BatchAlbumGenerator);

    }

    registerUI() {

        this.singleton("uiController", UIController);
        this.singleton("uiStateStore", UIStateStore);
        this.singleton("uiRouter", UIRouter);
        this.singleton("panelStateManager", PanelStateManager);
        this.singleton("dialogManager", DialogManager);
        this.singleton("notificationManager", NotificationManager);
        this.singleton("shortcutManager", ShortcutManager);
        this.singleton("dragDropManager", DragDropManager);
        this.singleton("uiCommandManager", UICommandManager);
        this.singleton("stateSynchronizer", StateSynchronizer);

    }

    singleton(name, ClassRef) {

        this.container.registerSingleton(

            name,

            () => new ClassRef()

        );

    }

}