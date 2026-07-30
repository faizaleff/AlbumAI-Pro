# ALB-043 Runtime Verification

Branch: `feature/alb-043-change-photo-folder`

Status: ALB-043.1 backend implemented; UI/runtime execution pending ALB-043.2

## Automated foundation verification

Run:

```text
cd com.albumai.pro
npm test -- --runInBand
```

The checked-in service harness verifies eight deterministic groups:

| Foundation scenario | Automated result |
| --- | --- |
| Browser-renderable classification accepts JPG/JPEG and rejects PNG | PASS |
| Valid preparation leaves active folder/library/selection/cache/persistence/token state untouched | PASS |
| Cancel, empty, unsupported-only, inaccessible, and token-failure classification | PASS |
| Atomic project-save failure restores metadata and leaves old runtime untouched | PASS |
| Successful save precedes one runtime replacement and preserves template metadata | PASS |
| Lifecycle-clear failure rolls persisted metadata back and reactivates old runtime | PASS |
| Same-folder refresh preserves the old token and requests cache preservation | PASS |
| A newer preparation supersedes an older delayed scan | PASS |

These tests use injected UXP/lifecycle collaborators and do not replace the
Photoshop runtime matrix below. The final toolbar and confirmation UI are not
implemented in ALB-043.1, so UI-labelled steps remain pending.

## Runtime diagnostic events now available

- `PHOTO_FOLDER_CHANGE_PREPARE_START`
- `PHOTO_FOLDER_CHANGE_PREPARED`
- `PHOTO_FOLDER_CHANGE_SAME_FOLDER`
- `PHOTO_FOLDER_CHANGE_SUPERSEDED`
- `PHOTO_FOLDER_CHANGE_FAILED`
- `PHOTO_FOLDER_CHANGE_COMMITTED`
- `PHOTO_FOLDER_CHANGE_METADATA_CACHE_FAILURE`
- `PHOTO_FOLDER_CHANGE_ROLLBACK_FAILURE`

Events contain transaction ids, statuses, counts, and bounded error names. They
do not contain folder paths or persistent-token values.

## Setup

Prepare:

- project A with registered templates, saved sort settings, and folder A;
- folder A with supported photos and at least one active thumbnail/Preview;
- folder B with different supported photos;
- an empty folder;
- an unsupported-only folder;
- an inaccessible or disconnected folder/token;
- a folder with enough JPEGs to keep one decode active and additional jobs
  waiting;
- an interrupted/non-running batch recovery snapshot.

At each named checkpoint record:

```js
globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__()
```

Capture:

```text
thumbnailCacheEntries:
activeObjectUrls:
liveBlobs:
activeBrowserDecodes:
activePreviewDecodes:
pendingJobs:
photoshopDocumentsOpenedByBrowser:
objectUrlsCreated:
objectUrlsRevoked:
staleJobsRejected:
cancelledBeforeRead:
cancelledAfterRead:
cancelledBeforePublish:
```

Also copy `project.json` before and after tests that exercise persistence.

## Global invariants

- No source photo opens as a Photoshop document.
- Project id/name and registered template descriptors/order remain unchanged.
- `project.json` is always valid JSON and recoverable through its backup.
- Only `photoSource`, `photoCount`, `updatedAt`, and explicitly confirmed
  incompatible recovery fields change during a different-folder commit.
- Old-generation results never publish into the new browser or Preview.
- Active/pending decode counts settle to zero.
- `activeObjectUrls === liveBlobs`.
- Every created reduced URL eventually revokes exactly once after final owner
  release.
- Generated `dist/index.js` is not committed.

## Test matrix

### A1 — Action placement and initial state

**Steps**

1. Open a project with folder A loaded.
2. Inspect the photo-browser toolbar.
3. Start an operation that sets the browser loading state.

**Expected**

- **Change Photo Folder** appears beside Refresh.
- It is disabled while a change/import is already in progress.
- Project and template controls remain unchanged.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### A2 — User cancels picker

**Steps**

1. Select photos and load a Preview in folder A.
2. Capture `A2-before`.
3. Click **Change Photo Folder**.
4. Cancel the UXP picker.
5. Capture `A2-after`.

**Expected UI**

- No confirmation appears.
- Folder A thumbnails, ordering, selection, focus, and Preview remain.

**Expected persistence/diagnostics**

- No queue cancel, cache clear, project save, or folder-change commit event.
- `project.json` is byte-for-byte unchanged.
- Runtime summary values are unchanged except unrelated completed work.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### A3 — User cancels confirmation

**Steps**

1. Pick valid different folder B.
2. Verify the confirmation describes selection/plan/recovery consequences.
3. Cancel the confirmation.

**Expected**

- Staged folder B is discarded.
- Folder A remains fully usable.
- No project save or ALB-042 lifecycle cancellation occurs.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### A4 — Successful different-folder change

**Steps**

1. In folder A, select multiple photos, focus one, and load Preview.
2. Record project id/name, template registry/order, sort setting, and
   `project.json`.
3. Pick folder B and confirm.
4. Wait for idle and capture `A4-after`.

**Expected UI**

- Only folder B photos appear in correct order.
- Old selection, focus, and Preview are cleared.
- The first folder-B selection/Preview works normally.
- Registered templates and current template controls remain.

**Expected persistence**

- `photoSource.name/token` and `photoCount` describe folder B.
- Project id/name, createdAt, template registry/order, sort, and unknown
  metadata fields are preserved.
- `Cache/metadata/photos.json` contains folder-B identities.

**Expected diagnostics**

- One confirmed change transaction.
- One different-folder generation increment.
- `QUEUE_CANCEL` and reasoned cache-clear summary.
- Released generation drains before folder-B publication.
- No stale old-folder URL/cache/Preview publication.
- `photoshopDocumentsOpenedByBrowser` remains zero.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### A5 — Same folder selected

**Steps**

1. Select photos and load Preview in folder A.
2. Pick folder A again through **Change Photo Folder**.
3. Wait for refresh and capture `A5-after`.

**Expected**

- No destructive confirmation is required.
- Same-folder refresh semantics run.
- Unchanged cache entries and valid selection/Preview identities remain.
- No full cache clear or duplicate photo models appear.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### B1 — Active thumbnail and Preview decode

**Steps**

1. Scroll folder A to start visible thumbnail work.
2. Rapidly select a photo so Preview is queued or active.
3. Prepare and confirm folder B while work remains.
4. Capture summary during release and after folder B settles.

**Expected**

- Old work may continue during picker/preparation.
- After verified persistence, pending old jobs cancel before read.
- An already-running read may finish only to the next cancellation checkpoint.
- No old renderer phase, URL, cache insertion, or component publication occurs
  after the released-generation summary.
- Folder-B browser work begins only after activation of its generation.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### B2 — Project batch running

**Steps**

1. Start a project batch.
2. Attempt **Change Photo Folder**.
3. Request batch cancellation and wait for completion.
4. Try again.

**Expected**

- The action is blocked while the batch is running.
- No picker or photo-state mutation occurs.
- It becomes available only after safe batch completion/cancellation.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### B3 — Existing recovery snapshot

**Steps**

1. Open a project with a non-running interrupted recovery snapshot.
2. Prepare folder B.
3. Inspect and accept the confirmation.
4. Reopen the project.

**Expected**

- Confirmation explicitly says incompatible photo recovery will clear.
- Successful commit persists `batchRecovery: null` with folder B.
- Templates and unrelated project data remain.
- Reopen does not offer recovery using folder-A photo ids.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C1 — Empty folder

**Steps**

1. From populated folder A, choose an empty folder.

**Expected**

- Change is rejected before confirmation/commit.
- Message states that no supported photos were found.
- Folder A, selection, Preview, cache, and project metadata remain.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C2 — Unsupported-only folder

**Steps**

1. From populated folder A, choose a folder containing only formats unsupported
   by the current browser producer.

**Expected**

- Change is rejected in v1 with supported-format guidance.
- No queue/cache/persistence mutation occurs.
- Folder A remains usable.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C3 — Inaccessible folder

**Steps**

1. Choose a folder that becomes unavailable during enumeration, or disconnect
   its volume before preparation completes.

**Expected**

- A recoverable error appears without exposing a full native path.
- Old runtime and `project.json` remain unchanged.
- Retrying with an accessible folder works.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C4 — Persistent-token failure

**Steps**

1. Use deterministic coverage or a host condition that makes
   `createPersistentToken()` fail/return an invalid token.

**Expected**

- Change does not commit or clear folder A.
- Error explains that the new folder cannot be restored after reload.
- No tokenless `photoSource` is saved.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C5 — Project save failure and rollback

**Steps**

1. Prepare valid folder B.
2. Force the atomic project write/rename/verification to fail.
3. Confirm the change.
4. Inspect runtime state, in-memory metadata, and disk files.

**Expected**

- Folder A remains displayed and usable.
- Old selection/Preview/cache remain.
- In-memory metadata restores the old `photoSource`, `photoCount`, and recovery.
- Disk `project.json` remains old and valid; backup/temp recovery is valid.
- Retrying after removing the fault succeeds.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C6 — Metadata cache write failure

**Steps**

1. Allow project save for folder B to succeed.
2. Force `Cache/metadata/photos.json` writing to fail.

**Expected**

- Folder B remains authoritative and active.
- A bounded recoverable cache warning appears.
- `project.json` is not rolled back to folder A.
- A later refresh/reopen can regenerate the metadata cache.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C7 — Plugin reload before project commit

**Steps**

1. Prepare folder B but reload/unload before confirming or before its project
   save commits.
2. Reopen project A.

**Expected**

- Project resolves folder A.
- No staged transaction survives reload.
- No stale scheduler or object URL survives the plugin instance.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C8 — Plugin reload after verified project commit

**Steps**

1. Confirm folder B.
2. Reload immediately after `PROJECT_COMMIT_VERIFIED`, before or during runtime
   publication/cache metadata writing.
3. Reopen the project.

**Expected**

- Atomic metadata resolves folder B.
- Folder B can be enumerated and published.
- No mixed folder-A/folder-B state appears.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C9 — Superseded change transaction

**Steps**

1. Start change A→B with a deliberately delayed scan/token.
2. Cancel or supersede it with A→C.
3. Allow B’s delayed result to complete.

**Expected**

- Only the latest transaction can confirm, persist, or publish.
- Folder B’s late result is diagnosed as stale and discarded.
- Final disk/runtime state consistently references folder C.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

### C10 — Object URL final-owner cleanup

**Steps**

1. Load thumbnails and Preview in folder A.
2. Change successfully to folder B.
3. Wait for old components to unmount and new folder to settle.
4. Close the project and capture a final summary.

**Expected**

- Old cache owners release during folder change.
- Mounted old images retain URLs only until unmount.
- Each old URL revokes once after its final owner.
- Final close reaches zero cache entries, active URLs, live Blobs, active
  decodes, and pending jobs.

**PASS/FAIL:** ☐ PASS ☐ FAIL

**Notes:**

## Final sign-off

- Core change workflow: ☐ PASS ☐ FAIL
- Persistence/rollback: ☐ PASS ☐ FAIL
- Recovery policy: ☐ PASS ☐ FAIL
- ALB-042 lifecycle invariant: ☐ PASS ☐ FAIL
- Project/template preservation: ☐ PASS ☐ FAIL
- Reload recovery: ☐ PASS ☐ FAIL
- Ready to merge: ☐ YES ☐ NO

Tester:

Date:

Photoshop/UXP versions:

Commit tested:

Blocking observations:
