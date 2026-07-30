# ALB-043 — Change Photo Folder Plan

Branch: `feature/alb-043-change-photo-folder`

Status: ALB-043.1 transaction foundation implemented; final UI pending

## ALB-043.1 implementation state

The transaction foundation is implemented without exposing the final browser
action. `AppController` orchestrates recovery policy while
`PhotoWorkspaceService` owns the centralized folder-change transaction.

The backend API is:

- `App.preparePhotoFolderChange(folder?)`
- `App.commitPhotoFolderChange(prepared, { clearRecovery })`
- `PhotoWorkspaceService.preparePhotoFolderChange(folder?)`
- `PhotoWorkspaceService.commitPreparedPhotoFolderChange(prepared, options)`

Preparation assigns a monotonically increasing transaction id, optionally
opens the picker, enumerates without touching the live workspace, classifies
the candidate, and detects the active folder. It creates no persistent token
and leaves no resource behind if confirmation is cancelled. It returns
explicit frozen status objects for prepared, cancelled, same-folder, empty,
unsupported-only, inaccessible, and superseded outcomes.

Commit operations are serialized. A confirmed different-folder commit drains
prior photo persistence, creates and validates the persistent token, snapshots
project metadata, atomically saves the new folder token, photo count, template
registry, and recovery decision, and only then advances the ALB-042 workspace
generation. A token failure occurs before save or runtime mutation. Commit then
clears old queue/service ownership,
publishes the staged library once, activates the new generation, refreshes
subscribers, and writes the non-authoritative metadata cache. Save failure
restores the complete prior in-memory metadata before runtime cancellation. A
lifecycle failure after persistence triggers an atomic metadata rollback and
reactivates the old workspace.

Any newer preparation supersedes an older unfinished scan, token, or commit.
Every asynchronous boundary before publication checks the transaction id.
Commit operations are serialized so a superseded persisted transaction can
finish rollback before a newer commit begins.

Same-folder selection deliberately creates no token and performs no project
save. Confirmation is unnecessary; commit routes through the existing
same-folder refresh with cache preservation and selection reconciliation.

Non-running recovery is reported as a decision requirement by `AppController`.
It is not cleared during preparation. When the caller confirms
`clearRecovery`, outstanding recovery writes are invalidated/drained and
`batchRecovery: null` is saved atomically with the new photo source. In-memory
recovery is cleared only after transaction success. Active project batches
return `BLOCKED_ACTIVE_BATCH`.

`FolderService.importPhotoFolder()` now returns non-sensitive counts for total
files, recognized images, browser-renderable JPEGs, and recognized unsupported
images. Folder-change diagnostics contain no paths or persistent tokens.

A lightweight webpack-based service test harness was added because the
repository had no test command or runner. `npm test -- --runInBand` covers:

- browser-renderable JPEG classification;
- preparation without active state mutation;
- cancel, empty, unsupported-only, inaccessible, and token-failure results;
- save-failure metadata/runtime rollback;
- successful persist-before-publish and exactly-one library replacement;
- lifecycle-clear failure rollback;
- same-folder refresh without token replacement;
- supersession of a delayed preparation.

ALB-043.2 remains responsible for the toolbar action, confirmation/recovery
decision UI, user-facing error copy, focused Preview reset, and Photoshop
runtime execution of the verification matrix.

## Objective

Add a safe, explicit **Change Photo Folder** workflow for an open project while
preserving project identity, template data, user settings, and the ALB-042
thumbnail lifecycle. A different folder intentionally replaces the current
photo library, so photo-dependent runtime state must be cleared in a controlled
and documented way.

## Existing flow summary

### Initial folder selection

1. `PhotoBrowserSection` shows **Open Folder** only in the empty browser state.
2. `OpenFolder.openFolder()` checks that a project is open, starts loading UI,
   and calls `App.importPhotos()`.
3. `AppController.importPhotos()` delegates to
   `PhotoWorkspaceService.importPhotos()` and clears placement/execution state
   if photos were returned.
4. `PhotoWorkspaceService.importPhotos()`:
   - increments `importRequestId`;
   - invokes `localFileSystem.getFolder()` when no folder was supplied;
   - calls `importPhotoFolder()` to enumerate entries, filter recognized image
     extensions, and create `Photo` models;
   - detects same-folder refresh by Entry identity/native path;
   - increments the workspace generation;
   - clears the passive `ThumbnailQueue`;
   - awaits `ThumbnailService.clear()`, which cancels scheduler work and drains
     the released generation;
   - clears selection for a different folder;
   - publishes the new library, activates the new generation, and calls
     `RefreshService.refresh()`;
   - queues persistent-token creation, `project.json` update, and
     `Cache/metadata/photos.json` writing in `persistencePromise`.
5. `OpenFolder.openFolder()` selects the first photo, updates folder UI state,
   and forces a React refresh.

### Persistent folder reference

`PhotoWorkspaceService.persistProjectState()` creates a UXP persistent token
and saves only:

```json
{
  "photoCount": 123,
  "photoSource": {
    "name": "Folder Name",
    "token": "uxp-persistent-token"
  }
}
```

`ProjectService.saveProject()` merges these fields into existing metadata and
uses `AtomicJsonFileWriter` for verified temp/backup/swap persistence.

### Project reopen

1. `ProjectService.openProject()` reads and recovers `project.json`, ensures the
   workspace folders, and activates the project.
2. `OpenFolder` calls `App.getPhotoFolderStatus()`.
3. `PhotoWorkspaceService.getPhotoFolderStatus()` resolves
   `metadata.photoSource.token` with `getEntryForPersistentToken()` and stores
   the resolved Entry in `sourceFolder`.
4. This validates availability but does not itself enumerate and publish
   photos. The existing UI requires a subsequent Refresh/Open action to load
   the library.

### Existing lifecycle cleanup

- Different-folder import: selection clears, completed thumbnail cache entries
  clear, queue/scheduler work is cancelled, active work drains, and a new
  workspace generation is activated.
- Same-folder refresh: valid `Photo` objects and completed cache entries are
  reused; removed/changed identities are invalidated; selection is retained
  only for existing identities.
- Preview: the selected/focused `PhotoImage` owns its source while mounted.
  Clearing selection and publishing a new library unmounts the old Preview,
  releasing its final consumer ownership.
- Project close/removal: `PhotoWorkspaceService.release()` or
  `removePhotos()` awaits thumbnail-service drain before clearing the library.

## Audit findings

### Safe reusable pieces

- UXP folder picker invocation.
- `importPhotoFolder()` enumeration and `Photo` construction.
- `sameFolder()` comparison.
- persistent-token creation and resolution.
- ALB-042 workspace generation propagation.
- passive queue cancellation and scheduler drain.
- bounded thumbnail cache ownership/revocation.
- library publication and `RefreshService`.
- atomic `project.json` writer.

### Unsafe direct reuse

The current `importPhotos()` method must not be connected directly to a new
**Change Photo Folder** button:

- it clears/publishes live runtime state before persistence succeeds;
- persistence happens later through a background promise;
- persistence failures are logged but not returned to the UI;
- a failed save can leave runtime state on the new folder while disk metadata
  still references the old folder;
- `ProjectService.saveProject()` mutates in-memory metadata before the atomic
  write, so a write failure also requires explicit in-memory rollback;
- an older `persistencePromise` must be drained before a new folder transaction
  so it cannot write an old `photoSource` after the change;
- a null persistent token is currently tolerated, which is not safe for an
  intentional replacement that must survive reload.

## Proposed architecture

Use a two-phase transaction owned by `PhotoWorkspaceService`, orchestrated by
`AppController`, with confirmation state in the browser UI.

### Phase A — Prepare without mutation

`preparePhotoFolderChange()` should:

1. Require an open project and reject while a project batch is running.
2. Capture a request/transaction id.
3. Open the UXP folder picker.
4. Return `CANCELLED` immediately if the user cancels.
5. Enumerate the selected folder into a staged result without modifying:
   - `sourceFolder`;
   - library photos;
   - selection/focus;
   - queue/scheduler;
   - cache/Preview ownership;
   - project metadata.
6. Classify the candidate:
   - same folder;
   - different valid folder;
   - empty folder;
   - recognized but browser-unsupported-only folder;
   - inaccessible/unreadable folder.
7. Return an immutable staged change descriptor containing only the current
   transaction id, candidate Entry, folder name, candidate photos, and
   non-sensitive counts. It must not be persisted across plugin reload.

### Phase B — Confirm and commit

For a different valid folder:

1. UI presents an inline confirmation after successful preparation.
2. Confirmation identifies the new folder and explains that photo selection,
   focused Preview, placement/execution plans, and incompatible batch recovery
   will be cleared; project identity and templates remain.
3. On confirmation, drain the previous photo-persistence promise and any
   recovery write that must be invalidated.
4. Create and validate a non-empty persistent token for the different folder.
   Token failure returns before project or runtime mutation.
5. Snapshot:
   - complete project metadata;
   - current recovery snapshot/classification;
   - current source folder/library/selection references for failure reporting;
   - current transaction and workspace generations.
6. Persist the new `photoSource`, `photoCount`, and required recovery change
   through the centralized service transaction using values assembled by
   `AppController`, so the current template registry and recovery policy are
   serialized together.
7. If persistence fails:
   - restore the prior in-memory project metadata;
   - restore recovery snapshot/classification;
   - keep the old folder, photos, selection, Preview, cache, and decodes
     untouched;
   - show a recoverable error.
8. After verified `project.json` commit:
   - increment `importRequestId` and workspace generation;
   - stop accepting old-generation thumbnail requests;
   - clear `ThumbnailQueue`;
   - await `ThumbnailService.clear({preserveCache: false})`;
   - discard stale renderer results;
   - set the new `sourceFolder`;
   - clear old selection and focused photo;
   - load staged photos;
   - activate the new queue/service generation;
   - publish through `RefreshService`;
   - clear photo-dependent placement/execution/Auto Save/export results.
9. Write `Cache/metadata/photos.json` after the authoritative project commit.
   A cache-write failure should be reported and retried later, but must not
   revert a verified `project.json` change.

### Same-folder selection

If the candidate is the current folder:

- skip destructive confirmation;
- route through the current same-folder refresh behavior;
- retain existing photos/cache entries when revision identity matches;
- retain only still-existing selections;
- keep the current Preview when its identity remains;
- repair/persist the folder token only if required.

## UI insertion point

The safest insertion point is the `PhotoBrowserSection` toolbar next to
**Refresh**:

- it is clearly scoped to the current photo workspace;
- it is available when a folder is already loaded, unlike the empty-state
  **Open Folder** action;
- project controls and template controls remain unaffected;
- it can share `isLoading`/disabled state with Refresh.

`OpenFolder` should own the asynchronous handler and confirmation state because
it already owns project/folder errors, loading status, focused photo id, and
the callbacks passed to `PhotoBrowserSection`.

Use an inline, keyboard-accessible confirmation region rather than
`window.confirm`, because the project has no established UXP modal abstraction.

## State transition sequence

```text
IDLE_CURRENT_FOLDER
  → PICKING
      → CANCELLED → IDLE_CURRENT_FOLDER
      → PICK/READ_ERROR → ERROR_WITH_OLD_FOLDER
      → PREPARED_SAME_FOLDER → REFRESHING → IDLE_CURRENT_FOLDER
      → PREPARED_INVALID → ERROR_WITH_OLD_FOLDER
      → PREPARED_DIFFERENT
          → USER_CANCELLED_CONFIRMATION → IDLE_CURRENT_FOLDER
          → COMMITTING_PERSISTENCE
              → SAVE_FAILED → ROLLBACK_METADATA → ERROR_WITH_OLD_FOLDER
              → SAVE_COMMITTED
                  → CANCELLING_OLD_GENERATION
                  → PUBLISHING_NEW_FOLDER
                  → WRITING_METADATA_CACHE
                  → IDLE_NEW_FOLDER
```

Only one change transaction may be current. Every continuation checks its
transaction id; late picker, scan, token, save, or cache-write results from a
superseded transaction are ignored.

## Project fields

### Must be preserved exactly

- `id`
- `name`
- `schemaVersion`
- `createdAt`
- project workspace/folder Entries
- `templateRegistry`
- current registered template order and file references
- `photoBrowserSort`
- all unknown/forward-compatible metadata fields
- Auto Save/export preferences if persisted in metadata
- completed project data unrelated to the old photo identities

`updatedAt` changes normally through project save.

### Intentionally replaced

- `photoSource.name`
- `photoSource.token`
- `photoCount`

### Must be reset after a different-folder commit

- photo library models
- selection ids and anchor
- focused photo id
- current Preview request/source ownership
- thumbnail load/failure state
- old folder cache aliases and cache ownership
- queue/scheduler work for the released generation
- placement plan
- placement execution plan
- replacement request and execution summaries
- current Auto Save/export result objects derived from the old execution

### Batch recovery policy

A batch may not change folders while running. A non-running recovery snapshot
contains old `selectedPhotoOrder`, `consumedPhotoIds`, `remainingPhotoIds`, and
`photoCursor`, so it cannot silently survive a different-folder commit.

Recommended policy:

- confirmation explicitly states that incompatible recovery will be cleared;
- recovery clearing and new `photoSource` persistence occur in the same
  authoritative project save;
- if that save fails, restore the old recovery snapshot and old metadata;
- same-folder refresh does not clear recovery.

## Failure and rollback handling

| Scenario | Required result |
| --- | --- |
| User cancels picker | Return to old folder with no state, diagnostic, or persistence mutation |
| User cancels confirmation | Discard staged descriptor; old folder remains fully active |
| Empty folder | Do not commit; show “No supported photos found”; old folder remains |
| Unsupported-only folder | Do not commit in v1; show supported-format guidance; old folder remains |
| Inaccessible/enumeration failure | Show recoverable error; old state and metadata remain |
| Persistent-token failure | Treat as blocking; do not replace the old folder |
| Same folder selected | Perform same-folder refresh; no confirmation or full cache clear |
| Project save failure | Restore in-memory metadata/recovery; do not cancel or replace old runtime state |
| Metadata cache failure after project save | Keep new authoritative folder, warn, and allow later rewrite |
| Active thumbnail decode | Let it continue during prepare; after verified save, cancel generation and await drain before new publication |
| Active batch | Block Change Photo Folder until cancellation/completion settles |
| Plugin reload before save commit | Existing project metadata restores old folder |
| Plugin reload after verified save | New persistent token is authoritative; reopen resolves the new folder |
| Superseded transaction | Ignore all late continuations by transaction id |

## Exact files likely to change

### Production

- `com.albumai.pro/src/components/OpenFolder.jsx`
  - change-folder handler, loading/error/confirmation state, focused-photo
    reset.
- `com.albumai.pro/src/components/PhotoBrowserSection.jsx`
  - toolbar button and confirmation callback/disabled presentation.
- `com.albumai.pro/src/app/AppController.js`
  - batch/recovery preflight, staged-change orchestration, placement-state
    reset, persistence callback, metadata/recovery rollback.
- `com.albumai.pro/src/services/PhotoWorkspaceService.js`
  - prepare/commit transaction, old persistence drain, token validation,
    generation-safe runtime swap.
- `com.albumai.pro/src/services/FolderService.js`
  - return staged folder statistics needed to distinguish empty and
    unsupported-only candidates.
- `com.albumai.pro/src/styles.css`
  - only if the existing toolbar/state styles cannot express the inline
    confirmation accessibly.

### Expected reuse without modification

- `ProjectService.js`
- `AtomicJsonFileWriter.js`
- `ThumbnailService.js`
- `BrowserDecodeScheduler.js`
- `ThumbnailQueue.js`
- `ThumbnailCache.js`
- `PreviewPanel.jsx`
- `PhotoImage.jsx`
- `SelectionEngine.js`

These files should change only if deterministic tests expose a missing
transaction or lifecycle primitive.

### Documentation/tests

- `ALB-043_CHANGE_PHOTO_FOLDER_PLAN.md`
- `ALB-043_RUNTIME_VERIFICATION.md`
- focused deterministic service/controller coverage in the repository’s
  existing test location if available; otherwise a checked-in lightweight
  lifecycle test harness should be proposed separately.

## Acceptance criteria

- A loaded project exposes **Change Photo Folder** beside Refresh.
- Picker cancellation changes nothing.
- Different-folder replacement requires explicit confirmation.
- The old folder remains usable until the new folder token and project save
  are verified.
- A save failure leaves disk metadata and runtime state on the old folder.
- Project id/name, registered templates/order, sort settings, and unrelated
  metadata are unchanged.
- Active batch execution blocks the action.
- Incompatible old-photo recovery is cleared only after explicit confirmation
  and successful atomic save.
- Old selection/focus/Preview/placement state cannot leak into the new folder.
- Old-generation scheduler work drains before new photo publication.
- No stale result, cache insertion, object URL, or Preview replacement occurs
  for the released generation.
- Same-folder selection uses refresh semantics and preserves unchanged cache
  entries/selections.
- Empty, unsupported-only, inaccessible, and token-failure candidates do not
  replace the current folder.
- Reopen after successful change resolves the new persistent token.
- Reopen after failed/cancelled change resolves the old token.
- No source photo opens as a Photoshop document.
- ALB-042 decode concurrency, cache bounds, URL ownership, and document
  invariant remain unchanged.

## Risks

- `ProjectService.saveProject()` mutates in-memory metadata before disk commit;
  ALB-043 must explicitly restore the prior metadata snapshot on failure.
- Background photo persistence or recovery writes can race the transaction
  unless drained/invalidated first.
- Clearing recovery is a user-visible destructive consequence and must be
  included in confirmation.
- A reload between atomic project save and runtime publication will reopen the
  new folder; this is consistent but must be tested.
- UXP Entry identity may lack `nativePath`; same-folder comparison needs an
  Entry/token fallback and must not rely on constructor names.
- Metadata cache writing is currently non-atomic and non-authoritative.
- Browser-supported formats are narrower than the recognized project image
  extensions.

## Non-goals

- Multiple simultaneous photo roots.
- Merging old and new photo libraries.
- Preserving selections across unrelated folder identities.
- Moving or copying source photos into the project.
- Changing project file schema.
- New image codecs or thumbnail architecture.
- Cloud paths, sync, licensing, Marketplace work, or UI redesign.
- Refactoring the general project/recovery architecture.

## Proposed atomic commit breakdown

1. `feat(project): add transactional photo folder replacement`
   - staged prepare/commit API, persistence drain, token validation,
     metadata/recovery rollback, lifecycle tests.
2. `feat(browser): add change photo folder confirmation`
   - toolbar action, inline confirmation, loading/error states, focus cleanup.
3. `docs(test): add ALB-043 runtime verification`
   - finalized runtime matrix and recorded results.

Each commit must build independently and must exclude
`com.albumai.pro/dist/index.js`.
