# ALB-040 — Photo Browser Bounded-Cache Investigation

## Scope and method

This investigation is source-level only. It traces the v1.0.1 photo-browser
path on `feature/alb-040-cache-diagnostics`; no Photoshop runtime session or
production-code instrumentation was added.

## Observed diagnostic message

The bounded-cache diagnostics are performance traces, not `console.warn`
messages:

- `THUMB_CACHE_SIZE` is emitted by `ThumbnailCache.set()` after eviction. Its
  current payload is `{ size }`.
- `THUMB_CACHE_EVICT` is emitted once for each over-limit LRU eviction. Its
  current payload is `{ key, size }`, where `size` is the post-eviction size.

`ThumbnailCache` is a `Map`-backed LRU cache configured as
`new ThumbnailCache(250)`. `get()` moves an entry to the end of the map;
`set()` replaces an existing key, inserts the new entry, and calls `evict()`.
`evict()` removes the oldest key until `size <= 250`.

## Root-cause analysis

The diagnostics describe expected bounded eviction when more than 250 unique
thumbnail values are inserted. They are not, by themselves, evidence of a
cache leak:

- Replacing an existing key deletes the old map entry before insertion. If the
  replaced value is a different `blob:` URL, it is released first.
- Eviction, `remove()`, and `clear()` all release tracked `blob:` URLs before
  removing entries. `PhotoBrowserPerformance.releaseObjectUrl()` is idempotent
  for untracked URLs and removes each released URL from its tracking set.
- A duplicate key therefore replaces one entry rather than growing the cache.
- Cache size cannot remain above 250 after `set()` returns.

The current production browser does not create thumbnail values on a cache
miss. `BROWSER_THUMBNAIL_MODE` is `bounded-cache-only`; `ThumbnailService`
returns `UNSUPPORTED` for a miss, and `ThumbnailQueue.add()` marks that photo
as a settled placeholder without enqueuing decode work. Static call-site
search found no in-repository caller of `ThumbnailService.setThumbnail()` and
no direct caller of `ThumbnailCache.set()` other than that method. Consequently
the normal browser workflow cannot currently produce `THUMB_CACHE_EVICT` from
newly decoded thumbnails.

If the diagnostic is observed in the host, it most likely comes from an
external/diagnostic caller that populates `ThumbnailService.setThumbnail()`, a
stale plugin build, or a runtime path outside the static browser call graph.
It should be correlated with `THUMB_CACHE_WRITE_ATTEMPT` and
`THUMB_CACHE_WRITE_SUCCESS` before treating it as a defect.

## Affected modules

- `src/cache/ThumbnailCache.js` — 250-entry LRU ownership, replacement,
  eviction, and blob release.
- `src/services/ThumbnailService.js` — stable cache-key construction,
  cache-only miss behavior, restoration, and the only wrapper for cache
  writes.
- `src/queue/ThumbnailQueue.js` — deduplicates queue work by photo identity,
  but currently settles cache misses without decode work.
- `src/services/PhotoWorkspaceService.js` — preserves the cache only for a
  same-folder refresh; clears it for a folder switch, removal, and release.
- `src/services/PhotoBrowserPerformance.js` — trace sampling and object-URL
  tracking/release diagnostics.
- `src/services/BrowserDecodeScheduler.js` and `src/components/PhotoImage.jsx`
  — only participate in the explicit diagnostic original-file fallback, which
  is disabled unless its global diagnostic flag is set.
- `src/components/ThumbnailGrid.jsx`, `ThumbnailCard.jsx`, and
  `PhotoBrowserSection.jsx` — virtualize rendering and read cached sources;
  they do not insert cache entries.

## Workflow trace

| Workflow | Cache behavior |
| --- | --- |
| Open a photo folder | A new folder clears queue and cache. The first 60 photos are offered as visible/overscan and the remainder as remaining, but misses settle as placeholders; no thumbnail value is inserted. |
| Scroll many photos | Virtualization updates visible/overscan membership. Queue de-duplication is by photo object and misses remain settled, so scrolling does not create duplicate cache entries. |
| Refresh the browser | The same-folder path preserves the cache and reuses matching photo objects by id. Cached values are restored; uncached entries remain placeholders. No write occurs. |
| Switch folders | Queue results are discarded, the thumbnail cache is cleared, tracked blob URLs are released, and selection is cleared. |
| Select/deselect photos | Selection changes update UI state and may reprioritize a photo, but a loaded or unavailable photo is not queued or inserted. |
| Close and reopen a project | Closing releases the workspace, clears queue/cache, releases tracked blob URLs, and clears selection. Opening a project does not restore thumbnail cache contents; it is session-only. |

## Expected or defective

Expected. A `THUMB_CACHE_EVICT` event means the intentionally bounded LRU
cache removed its least-recently-used item after a successful insertion. The
source path establishes bounded growth and release paths, and does not show a
duplicate-entry leak. The normal current browser path cannot reach cache
pressure because it has no production thumbnail producer.

The diagnostic payload is incomplete for operational diagnosis because it does
not include the limit, whether the insertion replaced a key, or a cumulative
eviction count. That is an observability gap, not a behavior defect.

## Recommended minimal fix

No production behavior change is recommended for v1.0.1. In particular, do
not raise the 250-entry limit and do not suppress `THUMB_CACHE_EVICT`.

If runtime evidence shows cache writes in a future diagnostic session, add an
opt-in verbose diagnostic summary at cache write/eviction boundaries only. It
should report `{ size, limit: 250, evictions, duplicateKeyAttempts }`, be gated
by `__ALBUMAI_VERBOSE_BROWSER_DIAGNOSTICS__`, and avoid a log per thumbnail.
Implement it only alongside a reproducible write-producing path; it is not
needed for the current cache-only browser.

## Regression risks

- Altering eviction or increasing the limit could retain more data/blob URLs
  and weaken the memory bound.
- Clearing on same-folder refresh would remove intentional warm-cache restore
  behavior.
- Re-enabling original-file decoding in normal browser cards would change the
  established placeholder, scheduling, and host-document safety behavior.
- Changing cache keys can invalidate warm-cache reuse and affect refresh and
  selection-visible rendering timing.

## Proposed verification steps

1. In a development build, open a folder with fewer than 250 photos; verify
   cache size never exceeds 250 and no eviction trace is emitted without a
   cache writer.
2. With an explicit diagnostic cache writer, insert more than 250 unique
   values and verify every `THUMB_CACHE_EVICT` leaves size at 250, retains the
   newest/recently-read values, and releases evicted `blob:` URLs.
3. Repeat a same-folder refresh and verify cached entries restore without new
   writes, while ordering, selection, preview, and batch inputs remain stable.
4. Switch to another folder, then close/reopen the project; verify cache clear
   traces and zero live tracked blob URLs after release.
5. Scroll a large folder, toggle icon/list view, select/deselect photos, and
   run batch preparation; verify no duplicate cache writes, no browser decode
   jobs in normal mode, and no regression in browser responsiveness.
