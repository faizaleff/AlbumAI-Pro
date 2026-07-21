# AlbumAI Pro — Architecture Inventory

## Scope and classification rules

This is a static inventory of every tracked repository path at the time of the
audit.  A path receives the status of the **first matching rule** below; rules
are ordered and mutually exclusive.  `node_modules/**` is classified as a
tracked vendor dependency tree, not as AlbumAI product code.

| Status | Meaning |
| --- | --- |
| ACTIVE | Loaded from the current UXP runtime rooted at `src/index.jsx`. |
| KEEP | Not loaded today, but retained as source, configuration, deployment, test, or reusable support material. |
| MERGE | A duplicate or competing implementation that must be consolidated before activation. |
| DEPRECATE | Legacy implementation retained temporarily for reference/compatibility. |
| REMOVE | Safe to remove after confirmation; no product behavior should depend on it. |

## ACTIVE — current UXP runtime

The following exact files are reachable from `src/index.jsx`:

```text
src/index.jsx
src/styles.css
src/controllers/PanelController.jsx
src/panels/AlbumBrowser.jsx.jsx
src/components/DragSelectionOverlay.jsx
src/components/OpenFolder.jsx
src/components/PreviewPanel.jsx
src/components/ThumbnailCard.jsx
src/components/ThumbnailGrid.jsx
src/components/Toolbar.jsx
src/app/AppController.js
src/cache/ThumbnailCache.js
src/core/LibraryEngine.js
src/core/ProjectEngine.js
src/core/SelectionEngine.js
src/models/Photo.js
src/queue/ThumbnailQueue.js
src/queue/ThumbnailWorker.js
src/services/FolderService.js
src/services/ImagingService.js
src/services/RefreshService.js
src/services/SelectionService.js
src/services/ThumbnailService.js
src/utils/FileUtils.js
```

## MERGE — competing application architectures

These are first-party source modules, but are not in the active UXP graph and
overlap the active runtime or another alternate architecture.

```text
src/controllers/AlbumController.js
src/controllers/AppController.js
src/controllers/ExportController.js
src/controllers/FolderController.js
src/controllers/MainController.js
src/controllers/PhotoController.js
src/controllers/TemplateController.js

src/container/**
src/core/album/**
src/core/bootstrap/**
src/core/export/**
src/core/files/**
src/core/ui/**
src/engine/**
src/services/**
src/ui/**
```

Exceptions to the `src/services/**` and `src/ui/**` rules are the ACTIVE files
listed above.  This group includes the duplicate AlbumEngine, AlbumManager,
AlbumFacade, AlbumPipeline, AlbumSession, AlbumStateManager, export, document,
UI, queue, cache, and bootstrap implementations.

The following Photoshop adapters also compete with lower-level Photoshop and
smart-object implementations and are MERGE candidates:

```text
src/core/photoshop/AlbumGenerationEngine.js
src/core/photoshop/DocumentManager.js
src/core/photoshop/DocumentScanner.js
src/core/photoshop/ImageFitService.js
src/core/photoshop/ImageTransformService.js
src/core/photoshop/LayerManager.js
src/core/photoshop/PhotoPlacementEngine.js
src/core/photoshop/PhotoReplacementPipeline.js
src/core/photoshop/PhotoSlotDetector.js
src/core/photoshop/PhotoshopAdapter.js
src/core/photoshop/SelectionManager.js
src/core/photoshop/SmartObjectManager.js
src/core/photoshop/TemplateAnalyzer.js
src/core/photoshop/TextLayerManager.js
src/core/photoshop/index.js
```

## DEPRECATE — inactive legacy bootstrap paths

```text
src/App.jsx
src/bootstrap.js
src/index.js
src/main.js
src/main.jsx
src/core/Application.js
src/core/ApplicationContext.js
src/core/CacheEngine.js
src/core/CacheManager.js
src/core/FilterEngine.js
src/core/HealthMonitor.js
src/core/JobManager.js
src/core/Kernel.js
src/core/LifecycleManager.js
src/core/MemoryManager.js
src/core/PerformanceMonitor.js
src/core/Plugin.js
src/core/ResourceManager.js
src/core/SearchEngine.js
src/core/TaskScheduler.js
src/core/WorkerPool.js
```

These paths should remain until a consolidation decision and migration plan are
approved. They must not be reintroduced into the UXP entry graph.

## KEEP — retained first-party modules and deployment material

The following path groups are not active today, but do not duplicate the
current UXP startup chain and should remain available for a future selected
architecture:

```text
LICENSE
README.md
Architecture/INVENTORY.md
docs/**
package.json
package-lock.json
webpack.config.js
plugin/**
dist/**
uxp-plugin-tests/**

src/album/**
src/cache/MemoryCache.js
src/config/**
src/constants/**
src/context/**
src/core/document/**
src/core/layers/**
src/core/photo/**
src/core/smartobjects/**
src/core/photoshop/BatchPlay.js
src/core/photoshop/BatchPlayHelper.js
src/core/photoshop/Constants.js
src/core/photoshop/ErrorHandler.js
src/core/photoshop/ExecuteModal.js
src/core/photoshop/HistoryManager.js
src/core/photoshop/Logger.js
src/database/**
src/hooks/**
src/layout/**
src/providers/**
src/templates/**
src/utils/**
```

`dist/**` is KEEP because this repository intentionally versions the built UXP
package. It is deployment output, not hand-maintained source.

## REMOVE — non-product and machine-generated clutter

```text
.DS_Store
dist/.DS_Store
src/.DS_Store
node_modules/**
src/styles/styles
```

`node_modules/**` is currently tracked, but can be regenerated from
`package.json` and `package-lock.json`. Remove it from version control only
after a clean-install verification. `src/styles/styles` is an extensionless,
unused stylesheet artifact.

## Completeness check

The rules above classify every tracked path:

1. ACTIVE exact files take precedence.
2. MERGE path groups take precedence over KEEP groups.
3. DEPRECATE exact files take precedence over all broad `src/**` groups.
4. KEEP covers all remaining first-party tracked code, configuration, tests,
   manifests, icons, and the intentionally tracked UXP package output.
5. REMOVE covers OS metadata, the vendor dependency tree, and the unused style
   artifact.

No deletion, migration, or code change is authorized by this inventory.
