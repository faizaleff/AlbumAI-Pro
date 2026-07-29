# ALB-041 — Thumbnail Decode and Refresh Hardening

## Defects found

### 1. Older folder scans could overwrite a newer import or refresh

`PhotoWorkspaceService.importPhotos()` previously had no request identity.
Two overlapping imports could complete out of order: a slower first folder scan
could still clear queue/cache, replace the library, and persist its state after
a later request had begun. This could show old-folder photos after a folder
switch or make rapid refresh outcomes depend on timing.

### 2. Same-folder refresh retained selections for deleted files

For a same-folder refresh, existing `Photo` objects are reused by id, which
correctly preserves selection for files still present. However, the selection
engine's id set was never reconciled against the freshly scanned list. A file
deleted or renamed after load could remain counted/selected even though it was
no longer in the browser or available to a batch.

## Root causes

- Folder enumeration is asynchronous, but the completion path had no
  generation/request guard.
- Selection state is id-based and intentionally survives same-folder object
  reuse, but lacked an operation to discard ids absent from the refreshed
  photo list.

## Changed modules

- `src/services/PhotoWorkspaceService.js`
  - Assigns a monotonically increasing import request id before asynchronous
    work begins.
  - Ignores a completed folder scan if a newer import, removal, or workspace
    release has superseded it.
  - Reconciles selection after the refreshed photo list is installed.
- `src/core/SelectionEngine.js`
  - Adds `retainAvailable(photos)`, which removes unavailable selected ids and
    clears an unavailable range-selection anchor while preserving surviving
    selections.

## Behavior before and after

| Scenario | Before | After |
| --- | --- | --- |
| Rapid refresh / overlapping import | A slower older scan could publish after a newer request. | Superseded scan returns without changing queue, cache, library, or project state. |
| Switch folders during an older scan | The older folder could reappear when its scan completed. | The older completion is ignored. |
| Same-folder refresh with deleted/renamed selected files | Stale ids could remain in selection count/state. | Only ids present in the new list remain selected; the anchor is cleared if absent. |
| Same-folder refresh with surviving selected files | Existing photo objects and selection remained selected. | Unchanged. |
| Thumbnail decode / cache | Cache-only browser behavior and bounds were unchanged. | Unchanged. |

## Lifecycle review

- Normal production browser thumbnails are `bounded-cache-only`: a cache hit
  is rendered; a miss is a settled placeholder and does not start a Photoshop
  document decode. Therefore normal folder load, scrolling, and large image
  sets do not produce duplicate decode jobs.
- `ThumbnailQueue.clear()` advances its generation. Any active queue result
  with the old generation is rejected, so old-folder queue results cannot
  update a current photo model.
- The explicit original-file browser fallback is diagnostic-only. `PhotoImage`
  uses request identity checks and cancels the matching scheduler job on
  unmount; `BrowserDecodeScheduler` releases active slots on cancel, timeout,
  completion, or synchronous failure.
- Decode failures in `ImagingService` are caught and its `finally` block
  releases image data and closes the temporary Photoshop document. Queue
  `finally` blocks also continue processing after failure.
- Cache keys use the photo id (normally native path), modification value, size,
  and thumbnail version. Identical filenames in different folders therefore
  do not collide when native paths are available.

## Regression risks

- An intentionally concurrent caller now receives `null` for a superseded
  import rather than an obsolete photo list. This is the required stale-result
  behavior.
- Selection reconciliation is performed only after the library adopts the
  refreshed list. It does not reorder photos or alter selections for files
  that still exist.
- No cache limits, decode concurrency, preview sources, or batch placement
  logic changed.

## Verification performed

- Source-level lifecycle review of folder scan, queue generation, cache lookup,
  scheduler cancellation, image cleanup, refresh subscribers, and selection
  update paths.
- Production build completed with `npm run build`.
- `git diff --check` completed without whitespace errors.

## Remaining limitations

- The normal production browser intentionally cannot generate thumbnails from
  uncached `FileEntry` values; it shows placeholders until a compliant source
  producer exists.
- The project has no configured automated test runner, so deterministic
  coverage was verified through the production build and focused code-path
  review. Manual UXP verification should cover rapid refresh, folder switch,
  deletion/rename followed by refresh, icon/list switching, preview selection,
  and batch preparation.

## Runtime verification

- The current browser UI does not expose a folder re-open or folder-switch
  action after a folder has been loaded.
- Therefore, the superseded-folder-scan scenario could not be reproduced
  manually through the current UI.
- The stale-scan protection was verified through code-path review and the
  implemented request-generation guard.
- Runtime verification covered refresh, rapid refresh, deleted-file cleanup,
  renamed-file cleanup, selection preservation, preview update, and console
  stability.
