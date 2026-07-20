// src/container/ServiceRegistry.js

// Core
import {
    PhotoManager,
    PhotoScanner,
    PhotoCollection,
    PhotoMetadata,
    PhotoAnalyzer,
    PhotoOrientation,
    PhotoDuplicate,
    PhotoFilter,
    PhotoSorter,
    PhotoCache,
    PhotoMatcher
} from "../core/photo";

import {
    AlbumManager
} from "../core/album";

import {
    DocumentManager
} from "../core/document";

import {
    LayerManager
} from "../core/layers";

import {
    SmartObjectManager
} from "../core/smartobjects";
import PhotoshopAdapter from "../core/photoshop/PhotoshopAdapter";

// Services
import {
    AlbumGenerationService,
    GenerationValidator,
    ProgressReporter,
    ResourceManager,
    ReportBuilder
} from "../services";

export default function registerServices(container) {

    //
    // Photo Engine
    //

    container.singleton("photoCollection", () =>
        new PhotoCollection()
    );

    container.singleton("photoCache", () =>
        new PhotoCache()
    );

    container.singleton("photoScanner", c =>
        new PhotoScanner({

            collection: c.resolve("photoCollection")

        })
    );

    container.singleton("photoMetadata", () =>
        new PhotoMetadata()
    );

    container.singleton("photoOrientation", () =>
        new PhotoOrientation()
    );

    container.singleton("photoAnalyzer", () =>
        new PhotoAnalyzer()
    );

    container.singleton("photoDuplicate", () =>
        new PhotoDuplicate()
    );

    container.singleton("photoFilter", () =>
        new PhotoFilter()
    );

    container.singleton("photoSorter", () =>
        new PhotoSorter()
    );

    container.singleton("photoMatcher", c =>
        new PhotoMatcher({

            filter: c.resolve("photoFilter"),

            sorter: c.resolve("photoSorter")

        })
    );

    container.singleton("photoManager", c =>
        new PhotoManager({

            collection: c.resolve("photoCollection"),

            scanner: c.resolve("photoScanner"),

            metadata: c.resolve("photoMetadata"),

            orientation: c.resolve("photoOrientation"),

            analyzer: c.resolve("photoAnalyzer"),

            duplicate: c.resolve("photoDuplicate"),

            filter: c.resolve("photoFilter"),

            sorter: c.resolve("photoSorter"),

            cache: c.resolve("photoCache"),

            matcher: c.resolve("photoMatcher")

        })
    );

    //
    // Core Managers
    //

    container.singleton("albumManager", () =>
        new AlbumManager()
    );

    container.singleton("documentManager", () =>
        new DocumentManager()
    );

    container.singleton("layerManager", () =>
        new LayerManager()
    );

    container.singleton("smartObjectManager", c =>
        new SmartObjectManager({
            layerManager: c.resolve("layerManager"),
            photoshopAdapter: new PhotoshopAdapter()
        })
    );

    //
    // Service Layer
    //

    container.singleton("progressReporter", () =>
        new ProgressReporter()
    );

    container.singleton("generationValidator", () =>
        new GenerationValidator()
    );

    container.singleton("reportBuilder", () =>
        new ReportBuilder()
    );

    container.singleton("resourceManager", c =>
        new ResourceManager({

            documentManager: c.resolve("documentManager"),

            smartObjectManager: c.resolve("smartObjectManager"),

            photoCache: c.resolve("photoCache")

        })
    );

    container.singleton("albumGenerationService", c =>
        new AlbumGenerationService({

            photoManager: c.resolve("photoManager"),

            albumManager: c.resolve("albumManager"),

            documentManager: c.resolve("documentManager"),

            layerManager: c.resolve("layerManager"),

            smartObjectManager: c.resolve("smartObjectManager"),

            validator: c.resolve("generationValidator"),

            progressReporter: c.resolve("progressReporter"),

            resourceManager: c.resolve("resourceManager"),

            reportBuilder: c.resolve("reportBuilder")

        })
    );

}
