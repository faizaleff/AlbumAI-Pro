# ALB-042 — Thumbnail Rendering Closeout

## Final confirmed root cause

The photo browser originally had no reliable browser-compatible image producer.
The photo model contains an accessible UXP File at `photo.file`, but assigning
that File directly to `HTMLImageElement.src` is invalid. Its runtime `url`
property is object-shaped, and the string returned by `getFsUrl(photo.file)`
also failed to load in the tested Photoshop UXP host.

Full-resolution Blob URLs could load, but retaining them caused the host to
retain full decoded pixel surfaces. Photoshop memory reached 40.04 GB during a
full-folder scroll. Revoking those URLs when virtualized cards unmounted
reduced retention but caused thumbnails to disappear and regenerate when the
user scrolled back.

Photoshop document rendering produced images, but opening and closing every
source as a Photoshop document caused visible flicker and took approximately
16 seconds for 36 photos. That architecture was rejected.

The preferred source is the JPEG preview embedded in EXIF metadata. Runtime
testing subsequently proved that a 1030-photo JPEG folder had no usable
embedded previews, leaving every card and Preview unavailable. JPEGs without
an embedded source now use one guarded software decode, immediately reduce to
the existing output profile, and cache only the reduced result. No Photoshop
document or full-resolution display source is created.

## Approaches that failed

| Approach | Observed result | Final disposition |
| --- | --- | --- |
| UXP File/FileEntry assigned to `img.src` | Rejected by the image element | Removed |
| `file.url` | Runtime value is object-shaped | Not used |
| `getFsUrl(photo.file)` | Resolved value did not load in this host | Not used |
| Session token or native filesystem path | Not a supported browser image source | Not used |
| Full-resolution Blob/data URL | Loaded, but retained very large decoded surfaces and caused URL churn | Removed from normal rendering |
| Canvas reduction | Required host capability was unavailable | Not used |
| Photoshop `app.open` plus `imaging.getPixels` | Rendered, but visibly opened/closed source documents | Removed from browser and Preview |
| Unbounded/full-resolution JPEG display | Excessive retained or transient memory | Removed |
| Guarded single-concurrency full-JPEG software decode | Transiently expensive, but produces a reduced source for JPEGs without EXIF previews | Final fallback |
| Embedded EXIF JPEG software decode | Stable reduced output with no document activity | Final implementation |

The development-only A–G capability probe remains available for an explicit
host-compatibility investigation. It is not invoked by normal browser or
Preview rendering and cleans up its temporary DOM nodes and object URLs.

## Final architecture

`ImageSourceCapabilityService` extracts the canonical UXP File, reads it with
`formats.binary`, and accepts JPEG/JPG for the reduced profiles.
`SoftwareJpegRenderer` then:

1. Scans bounded APP1/EXIF segments and validates TIFF and IFD offsets.
2. Selects the largest valid embedded JPEG candidate encountered.
3. Reads EXIF orientation and applies orientations 1 through 8 while reducing.
4. Decodes the embedded JPEG with a 2 MP / 32 MB guard when available.
5. Otherwise decodes the source JPEG once with a 40 MP / 820 MB allocation
   guard and single scheduler concurrency.
6. Samples orientation directly into the small target buffer, avoiding a
   second full-resolution oriented buffer.
7. Preserves aspect ratio and never upscales.
8. Encodes a new JPEG at the profile quality and creates one reduced Blob URL.
9. Transfers only that reduced URL to the bounded cache.

Files beyond the fallback guard, corrupt JPEGs, and non-JPEG formats produce a
bounded failure. They do not open a Photoshop document and do not retry on
every React render.

## Output profiles and display policy

### Browser thumbnail

- Cache suffix: `thumb-200-v5`
- Maximum long edge: 200 px
- JPEG quality: approximately 0.60
- No upscaling
- Aspect ratio and EXIF orientation preserved
- Icons and List display with `object-fit: cover`

The confirmed runtime output is typically 200 × 150.

### Preview

- Cache suffix: `preview-1000-v5`
- Maximum long edge: 1000 px
- JPEG quality: approximately 0.70
- No upscaling
- Aspect ratio and EXIF orientation preserved
- Displayed with `object-fit: contain`

The best embedded JPEG can be smaller than 1000 px. Preview therefore uses the
embedded source's native dimensions when its long edge is below the maximum;
the confirmed files typically produced approximately 300 × 225 or 240 × 300.
The 1000 px value is a ceiling, not a guaranteed output size.

## Queue, concurrency, and virtualization

The legacy folder thumbnail queue is passive. It tracks the viewport but does
not decode the initial folder or any offscreen remainder. Mounted `PhotoImage`
instances are the only normal callers that start generation.

- Icons render visible rows plus one overscan row.
- List renders visible rows plus two overscan rows.
- Completed cache entries are reused when scrolling back, changing selection,
  switching Icons/List, or refreshing an unchanged folder.
- In-flight requests are deduplicated by the profile-specific source identity.
- Software decoding concurrency remains one to bound transient memory.
- Preview uses priority 0, visible thumbnails priority 1, and overscan
  thumbnails priority 2.
- After at most two consecutive Preview jobs, a queued browser job is selected,
  preventing rapid Preview selection from starving visible thumbnails.
- A failed job always releases the scheduler slot.
- Exact duplicate JPEG content is fingerprinted after the required binary
  read. A matching profile reuses the existing reduced source instead of
  repeating a full software decode.

No full-folder Photoshop document processing exists.

## Cache identity and ownership

The cache limit remains 250 reduced-image entries. File identities initially
address requests, then map to a session-local content/profile identity:

- `jpeg-content-<sampled binary fingerprint>|thumb-200-v5`
- `jpeg-content-<sampled binary fingerprint>|preview-1000-v5`

The content fingerprint includes compressed byte length and two hashes sampled
across the complete file. It allows the supplied folder's exact copies to
share one reduced source per profile. File aliases are cleared on folder
release and removed individually during changed/deleted-photo invalidation.
Thumbnail and Preview outputs remain separate because they use different
dimensions and quality.

Every reduced Blob URL has explicit ownership:

- The renderer owns the newly created URL until the request result is accepted.
- The cache acquires one cache-owner reference when it stores the result.
- Each mounted displayed or pending `PhotoImage` acquires a consumer reference.
- The current Preview and the previous Preview retained during replacement are
  therefore independently protected.
- A stale generation result is disposed before it enters the cache.

Removing or evicting an entry releases only the cache owner. The URL remains
valid while any mounted image still has a consumer owner. It is revoked exactly
once after both the cache-owner count and consumer-owner count reach zero.
This prevents both revoke-on-unmount churn and eviction of an actively
displayed source.

LRU eviction removes the entry and reduces cache size immediately. If there is
no mounted consumer it also revokes the URL immediately, reducing the tracked
active-object-URL and live-Blob counts. If a mounted consumer remains,
revocation is deferred naturally until that final consumer releases.

Folder change, photo removal, project close, and plugin/browser service release
clear the relevant cache ownership. Mounted old-folder images retain their
sources only until React removes or replaces them. Double revocation is
prevented by the ownership map and tracked-URL guard.

## Refresh, source changes, and stale results

ALB-041 folder-scan generation guards remain in place. A new scan invalidates
or cancels superseded work before it can publish.

On same-folder refresh, a Photo model and its cache entries are reused only
when file size and modification time match. Deleted files and changed
revisions are explicitly invalidated; selection is retained only for files
that still exist. An unchanged refresh increments the request generation and
cancels stale in-flight work while preserving completed cache entries.

`PhotoImage` keys requests by stable file/profile identity. Unrelated rerenders
and selection overlay changes do not restart generation. A replacement loads
in a hidden image and is promoted only after `onload`; the previous valid
Preview remains visible while the newest selection is generated. Component
request ids reject stale completions, and generation ids reject results from a
superseded refresh or folder.

Failures are remembered per source/profile identity. They retry only after an
explicit refresh or a changed source identity.

## Post-release render investigation

The `SOFTWARE_JPEG_RENDER_START` and `SOFTWARE_JPEG_RENDER_FAILURE` events
observed after a zero-valued `PHOTO_WORKSPACE_RELEASE` summary represented real
continued work. They were not sampled messages appearing out of chronological
order.

The old scheduler cancellation path released an active job's accounting slot
as soon as cancellation was requested. Its underlying asynchronous
`file.read()` Promise was not cancelled and was no longer represented by
`pendingJobs`. When that read later resolved, the detached Promise entered
`SoftwareJpegRenderer`. The only stale-generation rejection was after the
complete render, so the late work could parse EXIF, encode, and potentially
create a URL before being discarded.

The corrected lifecycle propagates one workspace generation from `PhotoImage`
through `ThumbnailService`, `BrowserDecodeScheduler`,
`ImageSourceCapabilityService`, and `SoftwareJpegRenderer`. Cancellation is
checked:

1. before binary file read;
2. after binary file read;
3. before EXIF parsing;
4. before JPEG encoding;
5. before object URL creation;
6. before cache publication; and
7. before component state publication.

Pending scheduler jobs are removed without starting a read. Active jobs retain
their scheduler slot and remain in `pendingJobs` until their actual Promise
settles. Workspace release first makes the queue/service reject new work,
cancels both pending and active contexts, waits for the scheduler and public
requests to drain, and only then emits its runtime summary. Work that was
already inside an uninterruptible read may finish that read, but the
after-read checkpoint prevents it from entering the renderer.

The scheduler summary now counts waiting plus active jobs. It also reports
cumulative `staleJobsRejected`, `cancelledBeforeRead`, `cancelledAfterRead`,
and `cancelledBeforePublish` values independently of sampled console logging.
A deterministic release test with one active delayed read and one waiting job
confirmed:

- only the already-active file was read;
- the waiting file was never read;
- no software-render start or failure occurred;
- no object URL, cache insertion, or result publication occurred; and
- the final summary reported two stale jobs and zero active decodes, pending
  jobs, cache entries, active URLs, and live Blobs.

## Diagnostics closeout

The repeated `ALB014-CRASH` render stream was removed from the browser path.
Per-card remount, unmounted-update, Preview-source, sort, resize, virtual-window,
render-row, focus, keyboard, selection-count, and UI-ready events were removed.
Render profiling and virtualization details now require explicit development
flags.

Useful development diagnostics remain bounded:

- `SOFTWARE_JPEG_RENDER_SUCCESS` / `FAILURE`
- `THUMBNAIL_GENERATION_SUCCESS` / `FAILURE`
- `PREVIEW_GENERATION_SUCCESS` / `FAILURE`
- sampled `THUMB_CACHE_SIZE`
- sampled `LIVE_BLOBS`
- sampled `OBJECT_URL_CREATED` / `REVOKED`
- sampled `ACTIVE_BROWSER_DECODES`
- sampled cache eviction
- one cache-clear summary with its reason
- bounded stale-result rejection

Normal production traces do not include full user paths.

An `EmbeddedJpegUnavailableError` now produces a bounded profile failure with
the photo filename, an anonymized stable photo identity, profile, failure
reason, and error name. The same photo/profile is reported at most once in a
request generation. Selection changes, view switching, and React rerenders do
not retry it; an explicit refresh starts a new generation and may retry it.

Generation success/failure totals are recorded before the bounded console
logger, so log sampling cannot suppress runtime accounting. Object URL
creation/revocation totals are likewise updated at actual normal-renderer URL
creation and final release, before their sampled traces. Active decode and
pending-job values come directly from the scheduler snapshot rather than
console events.

`pendingJobs` now includes scheduler-waiting jobs and active render jobs. The
legacy `ThumbnailQueue` is passive and therefore contributes no hidden decode
work. The four cancellation counters are incremented at lifecycle checkpoints,
before any bounded stale diagnostic is sampled, so the summary remains
authoritative even when console events are suppressed.

Runtime Batch A also found a false document-invariant failure. The old verifier
required a truthy baseline and otherwise fell through to
`Math.max(1, afterOpenCount - (beforeOpenCount || 0))`. Consequently the
observed values `beforeOpenCount: null`, `afterOpenCount: 0`,
`beforeLiveReferences: null`, and `liveReferences: 0` fabricated one browser
document opening.

The verifier now compares each counter only when both baseline and after value
are finite. An unavailable comparison can emit one bounded
`BROWSER_DOCUMENT_INVARIANT_BASELINE_UNAVAILABLE`; it cannot increment the
summary or emit `BROWSER_DOCUMENT_INVARIANT_FAILED`. A failure is recorded only
when a comparable open-count or live-reference delta is positive.

Development can call:

```js
globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__()
```

It emits and returns:

```text
ALB_042_RUNTIME_SUMMARY {
  thumbnailCacheEntries,
  activeObjectUrls,
  liveBlobs,
  activeBrowserDecodes,
  activePreviewDecodes,
  pendingJobs,
  photoshopDocumentsOpenedByBrowser,
  thumbnailSuccesses,
  thumbnailFailures,
  previewSuccesses,
  previewFailures,
  objectUrlsCreated,
  objectUrlsRevoked,
  uniqueThumbnailFailureSources,
  uniquePreviewFailureSources
}
```

The helper is event-driven and creates no timer, polling loop, or render loop.
The required invariant is `photoshopDocumentsOpenedByBrowser === 0`.

## No Photoshop document rendering

Code-path review of `PhotoImage`, `PreviewPanel`, `ThumbnailCard`,
`ThumbnailGrid`, `ThumbnailService`, `ImageSourceCapabilityService`,
`SoftwareJpegRenderer`, `BrowserDecodeScheduler`, `PhotoWorkspaceService`,
`ThumbnailCache`, and the passive `ThumbnailQueue` found no browser/Preview
call to:

- `app.open`
- `documents.open`
- a BatchPlay `open` command
- `imaging.getPixels`
- temporary Photoshop document creation or close

The legacy `ImagingService` still contains an opt-in document fallback for
other application workflows. The ALB-042 browser and Preview producer does not
call that service.

## Changed modules

- `src/cache/ThumbnailCache.js` — explicit cache/consumer ownership and
  final-owner revocation.
- `src/components/PhotoBrowserSection.jsx` — removes ordinary interaction log
  noise.
- `src/components/PhotoImage.jsx` — stable request identity, pending-source
  validation, workspace-generation propagation, pre-publication cancellation,
  previous-image retention, and source ownership.
- `src/components/PreviewPanel.jsx` — separate Preview profile and reduced
  source-change logging.
- `src/components/ThumbnailCard.jsx` — browser profile and cover rendering
  without remount logging.
- `src/components/ThumbnailGrid.jsx` — visible-window generation, small
  overscan, and reduced scroll/render diagnostics.
- `src/queue/ThumbnailQueue.js` — passive viewport tracking rather than
  offscreen preprocessing, with generation-scoped activation and suspension.
- `src/services/BrowserDecodeScheduler.js` — bounded concurrency, profile
  priorities, Preview/browser fairness, accurate waiting/active accounting,
  and a release-drain boundary.
- `src/services/ImageSourceCapabilityService.js` — canonical binary read and
  reduced JPEG producer, content-source reuse, and before/after-read
  cancellation.
- `src/services/PhotoBrowserPerformance.js` — sampled diagnostics, object-URL
  accounting, document invariant, stale checkpoint counters, and runtime
  summary.
- `src/services/PhotoFileEntry.js` — canonical UXP File extraction and bounded
  capability diagnostics.
- `src/services/PhotoWorkspaceService.js` — refresh revision validation,
  targeted invalidation, generation activation, awaited stale cancellation,
  and cache-clear reasons.
- `src/services/SoftwareJpegRenderer.js` — embedded JPEG selection,
  guarded full-JPEG fallback, direct oriented reduction, JPEG encoding,
  content fingerprinting, and phase-boundary cancellation.
- `src/services/ThumbnailService.js` — v5 profiles, deduplication, stale/failure
  handling, content/profile cache aliases, shared-source invalidation,
  workspace-generation contexts, release drain, cache handoff, and summary
  helper.
- `src/config/browserImagePolicy.js` — records the reduced software-JPEG
  policy rather than an embedded-only policy.
- `src/app/AppController.js` — project close awaits photo-workspace release;
  Project Create/Open handlers and `ProjectService` are unchanged.
- `package.json`, `package-lock.json`, and `webpack.config.js` — pinned JPEG
  codec and browser Buffer support.

Generated `com.albumai.pro/dist/index.js` is intentionally excluded from the
commit.

## Runtime evidence

The accepted Photoshop runtime evidence for the embedded EXIF implementation:

- Software JPEG rendering succeeds.
- Browser output is typically 200 × 150.
- Preview output is typically around 300 × 225 or 240 × 300.
- First visible thumbnail was approximately 209 ms.
- First ten thumbnails were approximately 308 ms.
- Icons/List switching, rapid Preview selection, and same-folder refresh
  succeeded.
- Repeated rapid refresh kept `thumbnailCacheEntries`,
  `activeObjectUrls`, and `liveBlobs` stable at `41`.
- `activeBrowserDecodes`, `activePreviewDecodes`, and `pendingJobs` settled to
  `0`.
- Three thumbnail sources reported `EmbeddedJpegUnavailableError`.
- No source photo opened as a Photoshop document.
- Visible document open/close flicker was eliminated.
- Project Create completed atomic persistence and Recent File update, and the
  saved project reopened with its template registry, folders, and photo
  workspaces restored. No Project exception or red stack was captured.
- A zero-photo `PHOTO_FOLDER_UNAVAILABLE` event is a recoverable empty-project
  state, not a Project Open failure.
- The tested folder lifecycle was TestPhotos → the folder used for the
  100-photo test (containing 1030 images) → project/folder close → albumtest4
  → TestPhotos.
- Metadata publication for 1030 photos completed in approximately 344 ms.
- Final ownership cleanup reported `objectUrlsCreated: 34`,
  `objectUrlsRevoked: 34`, `activeObjectUrls: 0`, and `liveBlobs: 0`.
- A release-boundary run exposed real post-summary renderer work caused by a
  detached active scheduler Promise. The generation/drain correction prevents
  new renderer phases after an in-flight read and keeps that job accounted for
  until it truly settles.
- The 1030-photo compatibility folder contains 990 JPEGs at 10800 × 3600
  (38.88 MP) and 40 JPEGs at 5400 × 3600 (19.44 MP), with no usable embedded
  preview. Local fallback verification produced a 200 × 133 thumbnail from a
  19.44 MP source in approximately 0.8 seconds, a 200 × 67 thumbnail from a
  38.88 MP source in approximately 2.2 seconds, and a 1000 × 333 Preview in
  approximately 2.2 seconds.
- Exact duplicate JPEGs reused the same reduced URL after a binary fingerprint
  match; the duplicate request completed in approximately 2 ms without a
  second software render.
- Fallback verification created four reduced URLs and revoked all four on
  clear. Cache entries, active URLs, live Blobs, decodes, and pending jobs all
  returned to zero.
- The invariant diagnostic nevertheless observed unavailable before values and
  zero after values (`afterOpenCount: 0`, `liveReferences: 0`) and incorrectly
  reported one opening. The finite-delta correction addresses only that false
  diagnosis; it does not change rendering.

Batch A rendering performance and cache reuse are accepted. Project Create/Open
and the exercised folder-switch path are PASS/NOT REPRODUCED as failures; no
Project handler or `ProjectService` change was made. The corrected
release-drain boundary requires the focused retest below; plugin unload and
stress/eviction tests remain outstanding before merge.

## Supported formats and limitations

The normal producer supports JPEG/JPG files with or without an embedded EXIF
preview. The guarded full-JPEG fallback accepts sources up to 40 MP and up to
820 MB of jpeg-js tracked allocations. Files beyond either guard, corrupt
JPEGs, and non-JPEG formats fail gracefully with a bounded unavailable state.
There is deliberately no direct URL, full-resolution display Blob/data URL,
Canvas, or Photoshop document fallback.

Preview detail cannot exceed the best embedded source. A future off-document,
scaled native decoder or additional bounded codecs would be required for a
true high-detail 1000 px Preview and broader format coverage.

If a host exposes neither modification time nor file size, an in-place file
replacement may retain the old identity until an explicit invalidation policy
is added. Synchronous software decoding can also briefly occupy the UXP
JavaScript thread, although concurrency one and the small embedded source bound
the work.

## Final runtime acceptance checklist

Before merge, run these exact checks in Photoshop:

1. Load the representative 36-photo JPEG folder in Icons view. Confirm the
   first visible cards appear, filenames and selection overlays remain present,
   and no Photoshop source document opens.
2. Scroll to the end and back to the beginning twice. Confirm completed
   thumbnails remain visible immediately, cache hits replace regeneration, and
   memory stabilizes.
3. Switch Icons → List → Icons. Confirm the same cached sources remain visible
   without blanking or new software-render successes for already cached files.
4. Select at least ten photos rapidly. Confirm the previous valid Preview stays
   visible until the latest one loads, stale results never replace it, and
   browser thumbnails continue progressing after no more than two Preview jobs.
5. Refresh the unchanged folder twice rapidly. Confirm cached thumbnails are
   reused, selection/Preview remain valid, and stale work is rejected without
   repeated failure loops.
6. Delete one file and rename another, then refresh. Confirm both disappear
   from the old identity, selection is cleaned, unchanged files remain cached,
   and changed-source URLs release after their final owners are gone.
7. Test a corrupt JPEG, a JPEG without an embedded EXIF preview, and one
   non-JPEG format. Confirm the no-preview JPEG produces reduced thumbnail and
   Preview sources through `full-jpeg-software`; corrupt and non-JPEG inputs
   remain bounded failures and the queue continues.
8. Exceed the 250-entry cache with mounted and unmounted items. Confirm eviction
   reduces cache size; unmounted URLs revoke immediately, while a mounted card
   or current/previous Preview remains visible until it releases ownership.
9. Switch to another folder, close/reopen the project, and unload the plugin.
   Confirm old work cannot publish and all final old-folder Blob URLs are
   revoked.
10. Call `globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__()` after generation,
    refresh, folder switch, and teardown. Confirm decode counts settle to zero,
    cache/Blob counts match the expected lifecycle, and
    `photoshopDocumentsOpenedByBrowser` remains exactly `0`.

## Remaining risks

- Final Photoshop runtime testing is still required for the new ownership and
  eviction boundary, particularly eviction while an image remains mounted.
- A no-preview full-JPEG decode is synchronous and can temporarily use up to
  the 820 MB allocation guard. Local 38.88 MP verification took approximately
  2.2 seconds. Concurrency one prevents simultaneous peaks, but Photoshop
  responsiveness and memory must be verified on the 1030-photo folder.
- Preview quality is limited by the embedded JPEG and may be substantially
  below the 1000 px ceiling.
- Format coverage is intentionally limited to JPEG/JPG; non-JPEG codecs remain
  unavailable.
- Some camera-specific EXIF layouts may not expose their largest preview via
  the standard IFD1 JPEG offset/length tags.
- The 250-entry LRU is shared by thumbnail and Preview profiles; very large
  sessions can evict older entries and legitimately require regeneration.
