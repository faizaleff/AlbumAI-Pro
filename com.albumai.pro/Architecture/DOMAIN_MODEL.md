# AlbumAI Pro — Domain Model Audit

## Scope and method

Static read-only audit of `src/models`, `src/core`, `src/services`, and
`src/engine`. Status means current architectural disposition, not permission to
change code. The live UXP graph is rooted at `src/index.jsx`.

| Domain object | Active in UXP runtime? | Recommended status |
| --- | --- | --- |
| Photo | Yes | ACTIVE |
| Project | No | MERGE |
| Album | No | MERGE |
| Template | No | MERGE |
| Sheet | No | DEPRECATE |
| Export Job | No | MERGE |
| Smart Object | No | MERGE |

## Photo

### Implementations and ownership

| Implementation | Current owner | Fields/properties | Current usage | Status |
| --- | --- | --- | --- | --- |
| `src/models/Photo.js` (`Photo`) | Active UI/domain model | `file`, `id`, `name`, `extension`; thumbnail/preview; selection/favourite/rating/visibility flags; AI scores/tags/faces; dimensions/orientation/file metadata; loading/cache flags | Constructed by `services/FolderService`; consumed by active components, `ThumbnailService`, queues, caches, and `AppController` engines | ACTIVE |
| `src/core/photo/PhotoCollection.js` (`PhotoCollection`) | Alternate core photo stack | `Map<id, photo>` | Used only by alternate `PhotoManager` | KEEP |
| `src/core/photo/PhotoManager.js` (`PhotoManager`) | Alternate core photo stack | Collection plus scanner/metadata/orientation/analyzer/duplicate/filter/sorter/cache/matcher collaborators | Used by alternate container/generation design, not UXP entry | MERGE |
| `src/core/photo/PhotoMetadata.js`, `PhotoAnalyzer.js`, `PhotoDuplicate.js`, `PhotoFilter.js`, `PhotoMatcher.js`, `PhotoOrientation.js`, `PhotoScanner.js`, `PhotoSorter.js`, `PhotoCache.js`, `PhotoTypes.js` | Alternate photo processing services | Normalized metadata, type constants, analysis/cache/selection helpers | Not reached from active UI | KEEP |
| `src/engine/PhotoQualityEngine.js`, `SmartPhotoScorer.js`, `FaceGroupingEngine.js`, `EventGroupingEngine.js`, `DuplicateDetector.js` | Legacy engine analysis | Scores, groups, duplicate results | Only engine-to-engine references | DEPRECATE |

### Duplicate finding

`Photo` itself has one concrete model, but selection, metadata, caching,
analysis, duplicate handling and matching are split between the active UI
services and the disconnected `core/photo` and `engine` stacks. Retain the
active model; merge behavior only after selecting a single owner.

## Project

### Implementations and ownership

| Implementation | Current owner | Fields/properties | Current usage | Status |
| --- | --- | --- | --- | --- |
| `src/core/ProjectEngine.js` (`ProjectEngine`) | Active `app/AppController` | `folder`, `projectName` | Instantiated at startup; currently minimal and not populated by `OpenFolder` | ACTIVE |
| `src/album/AlbumProject.js` (`AlbumProject`) | Legacy album/engine stack | `name`, `folder`, `photos`, `selectedPhotos`, `template`, timestamps, settings (`albumSize`, dpi, bleed, color space, autosave/backup) | Constructed by `engine/WorkflowEngine`; read by album composer/selector/analyzer | MERGE |
| `src/core/album/AlbumProject.js` (`AlbumProject`) | Alternate core album stack | Wrapper state `project`; payload `id`, `name`, `template`, `photos`, `outputFolder`, `options`, timestamps | Created by `core/album/AlbumFactory`; managed by `AlbumProjectManager` | MERGE |
| `src/services/AlbumProjectService.js` | Alternate service stack | Keeps an opened project object with `openedAt` | Uses template/session/recent-file/validation services; unreachable from UXP entry | MERGE |

### Recommendation

There are three incompatible project shapes. Keep `ProjectEngine` only as the
active shell. Merge `AlbumProject` shapes into one future project aggregate;
do not make new project fields in the active UI until that decision is made.

## Album

### Implementations and ownership

| Implementation | Current owner | Fields/properties | Current usage | Status |
| --- | --- | --- | --- | --- |
| Plain album produced by `src/album/AlbumComposer.js` | Legacy `engine/AlbumEngine` | `name`, `template`, `created`, `totalPages`, `totalPhotos`, `pages[]` | Built by `engine/AlbumEngine`; not reached by UXP entry | MERGE |
| Page value produced by `AlbumComposer` | Legacy album composition | `id`, `pageNumber`, `name`, `template`, `slots[]`; each slot has `{ slot, photo }` | Rendered/exported only by legacy engine/exporter code | DEPRECATE |
| `src/core/album/AlbumMetadata.js` | Alternate core album stack | Album/template IDs and names, version, timestamps, author, counts, output folder | Metadata companion, not an album aggregate | KEEP |
| `src/core/album/AlbumEngine.js`, `AlbumManager.js`, `AlbumFacade.js`, `AlbumGenerator.js`, `AlbumPipeline*.js`, `AlbumWorkflow*.js` | Alternate core orchestration | Services and workflow state rather than one album value object | Only alternate bootstrap/container references | MERGE |
| `src/services/AlbumEngine.js`, `AlbumManager.js`, `AlbumFacade.js`, `AlbumOrchestrator.js`, `AlbumService.js`, `AlbumWorkflowService.js`, `AlbumWorkspaceService.js` | Alternate service orchestration | Runtime/service state | Disconnected from UXP entry | MERGE |
| `src/engine/AlbumAIEngine.js`, `AlbumEngine.js`, `AlbumOrchestrator.js`, `AlbumPipeline.js`, `WorkflowEngine.js` | Legacy engine orchestration | Project/album/run state | Disconnected engine graph | DEPRECATE |

### Duplicate finding

Album is represented both as a plain generated object and as several manager,
facade, engine and workflow abstractions. No canonical `Album` class exists.
The plain composition result is the closest value model; every orchestration
layer is a merge candidate.

## Template

### Implementations and ownership

| Implementation | Current owner | Fields/properties | Current usage | Status |
| --- | --- | --- | --- | --- |
| `src/album/PSDTemplate.js` (`PSDTemplate`) | Legacy album stack | `id`, `name`, `category`, `size { width,height,dpi }`, bleed, safe area, background, `layouts[]` | Expected by `AlbumProject`/`AlbumComposer`; not active | MERGE |
| `src/core/album/AlbumTemplate.js` (`AlbumTemplate`) | Alternate core album stack | `id`, `name`, `file`, page/smart-object counts, width, height, resolution, metadata | Returned/managed by template scanning/loading stack | MERGE |
| `src/core/album/TemplateManager.js`, `TemplateLoader.js`, `TemplateScanner.js`, `TemplateValidator.js`, `TemplateRepository.js`, `TemplateRegistry.js`, `TemplateCache.js`, `TemplateAnalyzer.js` | Alternate core template lifecycle | Loaded document and derived template descriptors | Alternate stack only | MERGE |
| `src/core/document/TemplateRegistry.js`, `src/services/TemplateRegistry.js`, `TemplateService.js`, `TemplateCacheService.js`, `AlbumTemplateService.js` | Competing service/document registries | Registry and loaded-template state | Disconnected service stack | MERGE |
| `src/core/photoshop/TemplateAnalyzer.js` | Photoshop adapter | Reads document groups/placeholders/sheets | Used only by alternate Photoshop stack | KEEP |

### Recommendation

Unify `PSDTemplate`'s layout-oriented shape with `AlbumTemplate`'s
PSD-document-oriented shape before enabling generation. Keep Photoshop
template analysis as an adapter, not as a competing template owner.

## Sheet

No dedicated `Sheet` class or model exists.

| Implementation | Current owner | Fields/properties | Current usage | Status |
| --- | --- | --- | --- | --- |
| Page plain object from `album/AlbumComposer.js` | Legacy engine | `id`, `pageNumber`, `name`, `template`, `slots` | Used as generated album pages | DEPRECATE |
| Sheet groups returned by `core/photoshop/TemplateAnalyzer.js` | Photoshop template adapter | Derived Photoshop layer/group descriptors; recognized by names matching `sheet` | Input to alternate template/slot analysis | KEEP |
| `core/album/AlbumSessionManager.js` current sheet field | Alternate session manager | `session.currentSheet` | Unreachable alternate state | MERGE |
| `core/album/ThumbnailManager.js` sheet cache keys | Alternate thumbnail manager | `sheet:<id>` cache keys | Unreachable alternate state | DEPRECATE |

Recommendation: do not introduce a sheet model yet. Decide whether a sheet is
a template spread, a generated page, or a Photoshop group; it currently means
all three.

## Export Job

### Implementations and ownership

| Implementation | Current owner | Fields/properties | Current usage | Status |
| --- | --- | --- | --- | --- |
| `src/core/album/AlbumJob.js` (`AlbumJob`) | Alternate album stack | `id`, template, photos, output folder, export options, status, progress, timestamps, error | Used conceptually by `AlbumExporter`; not active | MERGE |
| `src/core/album/AlbumWorkflowJob.js` | Alternate workflow stack | `id`, `name`, context, priority, status, lifecycle timestamps, error, result | Used by workflow queue/manager path | MERGE |
| `src/services/GenerationContext.js`, `GenerationPipeline.js`, `GenerationStateMachine.js`, `AlbumGenerationService.js` | Alternate generation stack | Job-derived context and generation state | Not active; currently has a missing `GenerationStates` import | DEPRECATE |
| `src/core/export/ExportManager.js`, `AlbumExporter.js`, `PSDExporter.js`, `BatchAlbumGenerator.js` | Alternate export stack | Running/cancelled state, project/options/progress | Alternate bootstrap only | MERGE |
| `src/engine/AlbumExportEngine.js` | Legacy engine | Export result and page preview values | Works on legacy plain albums | DEPRECATE |

### Recommendation

`AlbumJob` is the strongest candidate for a future export-job aggregate, but
its ownership and state machine overlap `AlbumWorkflowJob` and generation
context. Merge only after the generation stack compiles and is deliberately
adopted.

## Smart Object

### Implementations and ownership

| Implementation | Current owner | Fields/properties | Current usage | Status |
| --- | --- | --- | --- | --- |
| Smart-object slot object from `core/photoshop/PhotoSlotDetector.js` | Photoshop adapter | `id`, order, name, parent ID, type, assigned/image, width/height, rotation, scale, metadata | Derived from analyzed PSD placeholders; alternate stack only | KEEP |
| `src/core/photoshop/SmartObjectManager.js` | Photoshop adapter | Document/smart-object operations and BatchPlay collaborator | Alternate adapter graph; currently imports missing `BatchPlayService` | MERGE |
| `src/core/smartobjects/SmartObjectManager.js` | Alternate smart-object domain stack | Editor, scanner, resolver, replacer, transform/history collaborators | Used by alternate container | MERGE |
| `SmartObjectEditor.js`, `SmartObjectHistory.js`, `SmartObjectReplacer.js`, `SmartObjectResolver.js`, `SmartObjectScanner.js`, `SmartObjectTransform.js` | Smart-object support layer | Live Photoshop document/layer state and edit/replace operations | Unreachable but reusable adapter primitives | KEEP |
| `src/core/album/SmartObjectEditor.js`, `SmartObjectNavigator.js`, `SmartObjectReplaceEngine.js`, `SmartObjectService.js` | Album-specific replacement stack | Layer/image assignment and transform/replacement flow | Unreachable alternate album stack | MERGE |
| `src/core/photoshop/PhotoReplacementPipeline.js`, `PhotoPlacementEngine.js` | Photoshop generation adapters | Placement/replacement pipeline state | Alternate Photoshop graph | MERGE |

### Recommendation

Keep the low-level `core/smartobjects` primitives and one Photoshop adapter
boundary. Merge the album-specific replacement engines into a single service
only after template slots and export jobs have canonical models.

## Cross-domain conclusion

`Photo` is the sole active domain object. The rest of the domain model is
present but disconnected and split across legacy (`src/album`, `src/engine`),
alternate core (`src/core/album`, `src/core/*`), and service layers. Feature
development that introduces project, album, template, sheet, job, or
smart-object fields should pause until one aggregate owner is selected for
each domain.
