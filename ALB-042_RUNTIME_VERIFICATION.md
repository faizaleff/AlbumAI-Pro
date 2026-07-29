# ALB-042 Runtime Verification

Branch: `feature/alb-042-thumbnail-rendering`

This checklist verifies the embedded-EXIF thumbnail and Preview producer in
Photoshop before merge. Do not merge if any required test fails or if a browser
operation opens a Photoshop source document.

## Test setup and evidence

Use a development build and keep the Photoshop UXP developer console visible.
Record the Photoshop version, plugin build commit, test-folder description,
photo count, and approximate source dimensions.

At every named capture point run:

```js
globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__()
```

Record the complete result:

```text
thumbnailCacheEntries:
activeObjectUrls:
liveBlobs:
activeBrowserDecodes:
activePreviewDecodes:
pendingJobs:
photoshopDocumentsOpenedByBrowser:
thumbnailSuccesses:
thumbnailFailures:
previewSuccesses:
previewFailures:
objectUrlsCreated:
objectUrlsRevoked:
uniqueThumbnailFailureSources:
uniquePreviewFailureSources:
staleJobsRejected:
cancelledBeforeRead:
cancelledAfterRead:
cancelledBeforePublish:
```

Global requirements for every test:

- `photoshopDocumentsOpenedByBrowser` remains `0`.
- No source photo appears as a Photoshop document.
- `activeBrowserDecodes`, `activePreviewDecodes`, and `pendingJobs` return to
  `0` after the operation settles.
- `activeObjectUrls` and `liveBlobs` remain equal.
- No unbounded repeated failure or React-render logging occurs.

## Recorded Batch A evidence

Runtime Batch A on the representative folder confirmed:

- Embedded EXIF thumbnails and Preview rendered successfully.
- The first visible thumbnail appeared in approximately 209 ms, and the first
  ten appeared in approximately 308 ms.
- Icons/List switching, rapid Preview selection, and same-folder refresh
  completed successfully.
- Repeated rapid refresh held `thumbnailCacheEntries`, `activeObjectUrls`, and
  `liveBlobs` stable at `41`.
- `activeBrowserDecodes`, `activePreviewDecodes`, and `pendingJobs` settled to
  `0`.
- Three thumbnail sources reported `EmbeddedJpegUnavailableError`; this was the
  evidence that motivated the guarded full-JPEG compatibility fallback.

The same run exposed a diagnostics-only defect. An unavailable invariant
baseline was reported as `beforeOpenCount: null` and
`beforeLiveReferences: null`, while the actual after values were
`afterOpenCount: 0` and `liveReferences: 0`. The earlier comparison incorrectly
emitted `BROWSER_DOCUMENT_INVARIANT_FAILED` and changed
`photoshopDocumentsOpenedByBrowser` to `1`, even though no source document
opened.

The corrected diagnostic skips unavailable baseline comparisons, optionally
emits one `BROWSER_DOCUMENT_INVARIANT_BASELINE_UNAVAILABLE`, and records a
violation only for a confirmed positive finite delta. The minimal runtime
retest must confirm that this evidence now leaves
`photoshopDocumentsOpenedByBrowser` at `0`.

## Recorded lifecycle evidence

The latest Photoshop lifecycle run confirmed:

- Project Create completed its atomic save, updated Recent File, and published
  initial project state without requiring a photo folder.
- The saved project reopened, restored its template registry, folders, and
  photo workspaces, and produced no Project exception or red console stack.
- `PHOTO_FOLDER_UNAVAILABLE` with zero photos is a recoverable empty-project
  state. It is not evidence of a Project Open failure.
- The tested folder sequence was TestPhotos → the folder used for the
  100-photo test (containing 1030 images) → project/folder close → albumtest4
  → TestPhotos.
- Publication of metadata for 1030 photos completed in approximately 344 ms.
- Cleanup reached `objectUrlsCreated: 34`, `objectUrlsRevoked: 34`,
  `activeObjectUrls: 0`, and `liveBlobs: 0`.
- `photoshopDocumentsOpenedByBrowser` remained `0`.

The same run exposed a real release-boundary defect rather than sampled log
ordering. After a zero-valued release summary, an active scheduler Promise that
had been removed from scheduler accounting could finish its binary read and
enter `SoftwareJpegRenderer`, producing late `SOFTWARE_JPEG_RENDER_START` and
`SOFTWARE_JPEG_RENDER_FAILURE` events.

The correction keeps active work counted until its actual Promise settles,
propagates the workspace generation through every decode layer, cancels before
new phases, and waits for the released generation to drain before emitting its
final summary. A deterministic release test confirmed one active read and one
waiting job produced no renderer start, URL, cache entry, or publication; the
waiting job never read its file, and the final summary reported two stale jobs
with all active/pending/resource counts at zero.

The focused Photoshop retest passed that corrected release boundary:
`staleJobsRejected: 203` equaled `cancelledBeforeRead: 202` plus
`cancelledAfterRead: 1`; the release summary reported zero active decodes and
pending jobs, and no renderer phase occurred after it.

## No-embedded-preview compatibility evidence

The 1030-photo test folder contains 990 JPEGs at 10800 × 3600 (38.88 MP) and
40 JPEGs at 5400 × 3600 (19.44 MP). The files have no usable embedded EXIF
preview, so the embedded-only build showed unavailable cards and Preview.

The guarded fallback was verified directly against those files:

- 19.44 MP → 200 × 133 thumbnail in approximately 0.8 seconds.
- 38.88 MP → 200 × 67 thumbnail in approximately 2.2 seconds.
- 38.88 MP → 1000 × 333 Preview in approximately 2.2 seconds.
- An exact duplicate reused the same reduced source in approximately 2 ms
  without a second software decode.
- An embedded-preview JPEG continued using `embedded-exif-jpeg`.
- Four reduced URLs were created and all four were revoked on clear; cache,
  URL, Blob, active-decode, and pending-job counts returned to zero.

Photoshop runtime verification of the fallback on the full folder remains
required, particularly responsiveness and memory during scrolling.

## Batch A — Core functionality

### A1 — 36-photo Icons test

**Steps**

1. Start with no photo folder loaded and capture `A1-before`.
2. Open the representative folder containing 36 supported JPEG photos.
3. Leave the browser in Icons view and wait until visible thumbnails settle.
4. Select one visible card and wait for Preview to settle.
5. Capture `A1-after`.

**Expected UI result**

- Visible cards show thumbnails, filenames, and selection overlays.
- The selected photo appears in Preview with correct orientation and aspect
  ratio.
- No card or Preview opens a Photoshop source document or causes flicker.

**Expected diagnostics**

- Bounded `SOFTWARE_JPEG_RENDER_SUCCESS` and
  `THUMBNAIL_GENERATION_SUCCESS` events report
  `embedded-exif-jpeg`, with thumbnail long edge no greater than 200.
- Preview reports `PREVIEW_GENERATION_SUCCESS`, with long edge no greater than
  1000 and no upscaling beyond the embedded source.
- The three known sources without a usable embedded preview report one bounded
  thumbnail failure per photo/profile in the generation. Each event includes
  filename, anonymized identity, profile, and failure reason without a native
  path.

**Runtime summary values to capture**

- Record all `A1-before` and `A1-after` fields.
- At `A1-after`, cache entries, active URLs, live Blobs, and success counters
  should be greater than zero.
- `uniqueThumbnailFailureSources` should be `3` for the representative folder;
  `uniquePreviewFailureSources` depends on whether one of those three sources
  is selected for Preview.
- Decode and pending counts must settle to zero.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### A2 — Scroll to end and back twice

**Steps**

1. With the A1 folder still loaded, wait for idle and capture `A2-before`.
2. Scroll to the final photo at a steady pace and wait for visible work.
3. Scroll back to the first photo and wait for idle.
4. Repeat the end-and-back sequence once.
5. Capture `A2-after-first-return` and `A2-after-second-return`.

**Expected UI result**

- Thumbnails remain stable while scrolling.
- Returning to previously visited cards displays their cached images without a
  blank/reload cycle.
- Filename and selection overlays remain correct.

**Expected diagnostics**

- New generation successes are allowed only for photos first encountered while
  scrolling.
- Returning to an already visited range must not produce a second software
  render for those same profile/source identities.
- No object URL is revoked merely because a virtualized card unmounts.

**Runtime summary values to capture**

- Record all fields at each capture.
- Success counters must not increase on the second visit to the same ranges.
- Cache/URL counts may grow for newly visited photos but must remain bounded.
- Decode and pending counts must return to zero.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### A3 — Icons/List/Icons cache reuse

**Steps**

1. Return to the first visible range in Icons view and capture `A3-before`.
2. Switch to List view and wait for paint.
3. Switch back to Icons view and wait for paint.
4. Capture `A3-after`.

**Expected UI result**

- Both views show the same photos in the same sort order.
- Thumbnails stay visible through each switch.
- Selection and focused-photo state remain correct.

**Expected diagnostics**

- The view-switch diagnostic may appear once per switch.
- Already cached sources do not produce additional
  `SOFTWARE_JPEG_RENDER_SUCCESS` or generation-success events.
- There is no revoke/create churn for unchanged cached entries.

**Runtime summary values to capture**

- Record all fields at both captures.
- Thumbnail/Preview success counters and cache/URL counts should remain
  unchanged for the already cached range.
- Decode and pending counts must be zero after the switch.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### A4 — Rapid Preview selection

**Steps**

1. Select a photo and wait for a valid Preview.
2. Capture `A4-before`.
3. Rapidly select at least ten different visible photos, finishing on a known
   target photo.
4. Observe Preview continuously and wait until all scheduled work settles.
5. Capture `A4-after`.

**Expected UI result**

- The previous valid Preview remains visible until a replacement loads.
- The final Preview matches the last selected photo.
- An older asynchronous result never replaces the final selection.
- Browser thumbnails continue progressing during rapid Preview activity.

**Expected diagnostics**

- Preview start/success events remain bounded.
- Scheduler activity never exceeds one active decode.
- After at most two consecutive Preview jobs, queued browser thumbnail work
  can progress.
- No document-invariant failure occurs.

**Runtime summary values to capture**

- Record all fields at both captures.
- `activeBrowserDecodes + activePreviewDecodes` must never exceed `1`.
- At `A4-after`, active/pending counts must be zero and Preview successes should
  reflect completed unique profile/source requests.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### A5 — Basic same-folder refresh

**Steps**

1. Wait for the current folder to become idle and capture `A5-before`.
2. Click Refresh once without changing any files.
3. Wait for refresh, browser, and Preview work to settle.
4. Capture `A5-after`.

**Expected UI result**

- Ordering, thumbnails, selection, and Preview remain stable.
- No visible thumbnail reload occurs for unchanged files.

**Expected diagnostics**

- `SAME_FOLDER_REFRESH_REUSED` reports the unchanged models as reused.
- Completed cache entries are preserved.
- No second software render occurs for unchanged cached profile/source
  identities.

**Runtime summary values to capture**

- Record all fields at both captures.
- Cache/URL counts and generation-success counters should remain unchanged for
  the cached set.
- Active and pending counts must return to zero.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### A6 — Rapid repeated refresh

**Steps**

1. Capture `A6-before`.
2. Trigger Refresh repeatedly as quickly as the UI permits.
3. Wait until the last refresh settles.
4. Capture `A6-after`.

**Expected UI result**

- Only the newest scan publishes.
- The browser never becomes stuck in a loading state.
- Ordering, existing selection, and Preview remain correct.

**Expected diagnostics**

- Superseded folder/image results may produce bounded stale-result rejection.
- Queue/scheduler work settles normally.
- No failure retries loop after the final refresh.

**Runtime summary values to capture**

- Record all fields at both captures.
- At `A6-after`, active and pending counts must be zero.
- For the unchanged representative folder, cache entries, active URLs, and
  live Blobs should remain stable at `41`.
- The document count remains zero. A missing baseline may emit one
  `BROWSER_DOCUMENT_INVARIANT_BASELINE_UNAVAILABLE`, but must not emit
  `BROWSER_DOCUMENT_INVARIANT_FAILED`.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

## Batch B — Lifecycle

### B1 — Rename/delete refresh

**Steps**

1. Select one photo that will be renamed and one that will be deleted.
2. Capture `B1-before`.
3. Rename the first file and delete the second file outside Photoshop.
4. Click Refresh and wait for idle.
5. Capture `B1-after`.

**Expected UI result**

- The deleted identity disappears.
- The renamed file appears only under its new identity.
- Selection retains only files that still exist.
- Unchanged thumbnails remain stable.

**Expected diagnostics**

- Changed/deleted cache identities are invalidated.
- Old URLs revoke only after their final mounted consumer releases.
- Unchanged entries are reused and do not regenerate.

**Runtime summary values to capture**

- Record all fields at both captures.
- Cache/URL counts should reflect removal of old identities plus any newly
  generated renamed identity.
- Failure counters must not increase solely because files were intentionally
  removed before refresh.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### B2 — Folder replacement/switch

**Steps**

1. Load folder A, wait for thumbnails and Preview, and capture `B2-folder-A`.
2. Use the available project/folder workflow to replace folder A with folder B.
3. Wait for folder B to settle and capture `B2-folder-B`.
4. If the current UI has no folder-switch action, mark this test blocked and
   record the exact UI limitation rather than simulating an unsupported path.

**Expected UI result**

- No folder-A thumbnail or Preview publishes after folder B becomes current.
- Folder-B ordering and selection state are correct.
- No source photo opens as a Photoshop document.

**Expected diagnostics**

- `FOLDER_SWITCH`, `QUEUE_CANCEL`, and one
  `THUMBNAIL_CACHE_CLEAR_SUMMARY` occur.
- The clear summary reports zero cache entries immediately after cache clear.
- URLs retained briefly by mounted old-folder images revoke after those images
  unmount.
- Once the released generation's final runtime summary is emitted, it produces
  no new binary read, software-render start, object URL, cache insertion, or
  component publication.

**Runtime summary values to capture**

- Record all fields at both captures and once immediately after switch cleanup
  if possible.
- Final active/pending counts must be zero.
- Final URL/Blob counts must contain only folder-B sources.

**Result:** ☒ PASS ☐ FAIL ☐ BLOCKED

**Notes:** The normal project/folder lifecycle successfully exercised
TestPhotos → the 1030-image source directory → close → albumtest4 → TestPhotos.
No stale old-folder UI publication or Photoshop document opening was observed.
The release-drain correction requires the focused post-release console retest
described under B5.

### B3 — Project reopen

**Steps**

1. With a populated project idle, capture `B3-before-close`.
2. Close the project through the normal AlbumAI workflow.
3. Reopen the same project and restore its photo folder.
4. Wait for the browser and Preview to settle.
5. Capture `B3-after-reopen`.

**Expected UI result**

- Project reopen restores the expected photo folder and ordering.
- Stale pre-close images never appear.
- Selection and Preview follow the current project state.

**Expected diagnostics**

- Project close releases the old workspace cache ownership.
- Reopen creates only current-project generation events.
- No document-invariant failure occurs.

**Runtime summary values to capture**

- Record all fields before close and after reopen.
- After reopen settles, active/pending counts must be zero and all tracked URLs
  must belong to the reopened session.

**Result:** ☒ PASS ☐ FAIL

**Notes:** Project Create completed atomic persistence and Recent File update.
The existing project reopened and restored project metadata, template registry,
folders, and photo workspaces with no Project exception. The earlier P0
Create/Open report is not reproduced. A zero-photo `PHOTO_FOLDER_UNAVAILABLE`
state remains recoverable and must not be classified as an Open failure.

### B4 — Plugin unload/reload

**Steps**

1. With generated thumbnails and Preview idle, capture `B4-before-unload`.
2. Unload the plugin through UXP Developer Tools.
3. Confirm cleanup/revocation diagnostics before the console disconnects.
4. Reload the plugin, reopen the test project/folder, wait for idle, and capture
   `B4-after-reload`.

**Expected UI result**

- Plugin unload leaves no visible temporary Photoshop documents.
- Reload starts a clean browser session and renders normally.

**Expected diagnostics**

- Teardown clears cache ownership and revokes final URLs once.
- Reload does not report stale results from the previous plugin instance.

**Runtime summary values to capture**

- Record all fields before unload and after reload.
- Record the final pre-disconnect cache-clear and revoke counts.
- The reloaded session must settle with zero active/pending work and document
  count zero.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### B5 — Runtime summary before and after cleanup

**Steps**

1. Generate several thumbnails and at least one Preview.
2. Capture `B5-populated`.
3. Remove the photo folder or close the project through the normal UI.
4. Wait for all mounted images to unmount and capture `B5-clean`.

**Expected UI result**

- The browser returns to its empty/project-closed state.
- No old thumbnail or Preview remains visible.

**Expected diagnostics**

- One reasoned cache-clear summary occurs.
- Each released URL has at most one `OBJECT_URL_REVOKED` event.
- No revoke-skipped or double-revoke pattern occurs.
- The release summary is emitted only after the released generation's scheduler
  waiting jobs and active renderer Promise have drained.
- Cancellation is reported through bounded stale counters; no
  `SOFTWARE_JPEG_RENDER_START` or `SOFTWARE_JPEG_RENDER_FAILURE` for the
  released generation may follow the summary.

**Runtime summary values to capture**

- Record all fields at both captures.
- `B5-clean` must report cache entries, active URLs, live Blobs, active decodes,
  and pending jobs all equal to `0`.
- `photoshopDocumentsOpenedByBrowser` remains `0`.
- Capture `staleJobsRejected`, `cancelledBeforeRead`,
  `cancelledAfterRead`, and `cancelledBeforePublish`. These are cumulative
  lifecycle outcomes and do not need to return to zero.

**Result:** ☐ PASS ☐ FAIL

**Notes:** URL ownership cleanup passed in the recorded run:
created/revoked `34/34`, active URLs `0`, and live Blobs `0`. The corrected
release-drain retest also passed: 202 waiting jobs were cancelled before read,
one active job was cancelled after read, and no renderer event followed the
zero-valued release summary.

## Batch C — Edge and stress

### C1 — Corrupt JPEG

**Steps**

1. Add one deliberately corrupt `.jpg` to an otherwise valid test folder.
2. Load or refresh the folder and scroll the corrupt item into view.
3. Wait for the queue to settle and capture `C1-after`.
4. Cause unrelated rerenders without refreshing.

**Expected UI result**

- The corrupt card shows the bounded unavailable state.
- Other thumbnails and Preview continue working.
- The corrupt item does not repeatedly flash or retry.

**Expected diagnostics**

- One bounded software/generation failure is recorded for its identity.
- The scheduler releases the failed job and continues.
- No further attempt occurs until explicit refresh or identity change.

**Runtime summary values to capture**

- Record all fields at `C1-after`.
- Thumbnail failures increase for the corrupt item; active/pending counts settle
  to zero and successes continue for valid files.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### C2 — JPEG without embedded EXIF preview

**Steps**

1. Add a valid JPEG known to contain no usable embedded EXIF JPEG.
2. Load or refresh and bring it into view.
3. Select it for Preview and wait for idle.
4. Capture `C2-after`.

**Expected UI result**

- Card and Preview show reduced images.
- No full-resolution display source or Photoshop document opening occurs.
- Other items remain functional.

**Expected diagnostics**

- `SOFTWARE_JPEG_RENDER_SUCCESS` reports input `full-jpeg`.
- Thumbnail and Preview generation report strategy
  `full-jpeg-software`, with long edges no greater than 200 and 1000.
- Exact duplicate content reuses the reduced content/profile cache rather than
  repeating the full decode.

**Runtime summary values to capture**

- Record all fields at `C2-after`.
- Success counters increase; active/pending counts settle to zero and document
  count remains zero.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### C3 — PNG/non-JPEG

**Steps**

1. Add a PNG or another accepted non-JPEG photo format.
2. Load or refresh and bring it into view.
3. Select it for Preview and wait for idle.
4. Capture `C3-after`.

**Expected UI result**

- The non-JPEG item fails gracefully with the unavailable state.
- It is never assigned through a direct Entry URL or full-image Blob.
- Other JPEG items remain functional.

**Expected diagnostics**

- Resolution/generation failure reports
  `EmbeddedPreviewUnsupportedFormatError`.
- No software full-image decode and no Photoshop document event occurs.

**Runtime summary values to capture**

- Record all fields at `C3-after`.
- Failure counters increment once per requested profile, active/pending counts
  settle to zero, and document count remains zero.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### C4 — More than 250 cache entries

**Steps**

1. Load a folder containing more than 250 compatible JPEGs.
2. Traverse enough photos and Previews to create more than 250 distinct profile
   identities.
3. Wait for idle and capture `C4-after-eviction`.
4. Revisit an old evicted, unmounted item and capture `C4-after-revisit`.

**Expected UI result**

- Browser remains responsive and correctly virtualized.
- The oldest unmounted entry may regenerate after legitimate LRU eviction.
- Visible/mounted images do not disappear during eviction.

**Expected diagnostics**

- Sampled `THUMB_CACHE_EVICT` events occur.
- Cache size never remains above 250 after insertion/eviction settles.
- Unowned evicted URLs revoke once.

**Runtime summary values to capture**

- Record all fields at both captures.
- `thumbnailCacheEntries` must be no greater than `250`.
- Active URLs may temporarily exceed cache entries only for evicted sources
  still held by mounted consumers; they must fall after those consumers
  release.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### C5 — Cache eviction while Preview remains mounted

**Steps**

1. In the greater-than-250 folder, select an early photo and wait for its
   Preview.
2. Leave that Preview selected and visible.
3. Scroll through enough new photos to push the early Preview cache entry to
   the LRU boundary and trigger eviction.
4. Confirm the Preview remains visible and capture `C5-while-mounted`.
5. Select a replacement Preview and wait for it to load.
6. Capture `C5-after-release`.

**Expected UI result**

- The evicted-but-mounted Preview remains visible.
- The old Preview stays visible while its replacement loads.
- It disappears only after the replacement is ready and ownership transfers.

**Expected diagnostics**

- Eviction reduces cache size but does not revoke the mounted URL immediately.
- The old URL receives one revoke event only after the old Preview consumer
  releases it.

**Runtime summary values to capture**

- Record all fields at both captures.
- At `C5-while-mounted`, active URLs may exceed cache entries by the mounted
  evicted source.
- At `C5-after-release`, the extra active URL/live Blob must be gone.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

### C6 — Final-owner object URL revocation

**Steps**

1. Identify one cached source and capture `C6-cached-and-mounted`.
2. Trigger explicit invalidation or eviction while its image remains mounted.
3. Unmount or replace the final image consumer.
4. Capture `C6-final-owner-released`.
5. Review the URL-id diagnostics for the complete sequence.

**Expected UI result**

- The source stays visible while the consumer owner exists.
- Releasing the final owner causes no flicker in an unrelated current image.

**Expected diagnostics**

- Exactly one `OBJECT_URL_CREATED` and exactly one
  `OBJECT_URL_REVOKED` occur for the tested URL id.
- No second revoke and no `BLOB_URL_REVOKE_SKIPPED` event occurs.

**Runtime summary values to capture**

- Record all fields at both captures.
- Active URL/live Blob counts decrease by one after the final owner releases.
- Cache, active decode, pending, and document invariants remain valid.

**Result:** ☐ PASS ☐ FAIL

**Notes:**

## Final sign-off

- Batch A: ☐ PASS ☐ FAIL
- Batch B: ☐ PASS ☐ FAIL ☐ BLOCKED
- Batch C: ☐ PASS ☐ FAIL
- Photoshop document invariant: ☐ PASS ☐ FAIL
- Cache/URL ownership invariant: ☐ PASS ☐ FAIL
- Ready to merge: ☐ YES ☐ NO

Tester:

Date:

Photoshop/UXP versions:

Commit tested:

Blocking observations:
