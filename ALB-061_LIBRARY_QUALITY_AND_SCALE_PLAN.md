# ALB-061 — Library Quality and Scale

Status: **AUTOMATED COMPLETE — PHOTOSHOP/UXP RUNTIME PENDING**

## Goal

Complete the Photo Library quality and scale foundation with explainable exact
duplicate grouping, deterministic cache lifecycle guarantees, measurable
performance budgets, and safe Photoshop/UXP large-folder qualification.

## Architecture boundaries

- `PhotoWorkspaceService` remains the Photo domain owner.
- `LibraryEngine` remains the authoritative in-memory photo collection.
- `ThumbnailCache` remains the only thumbnail source cache.
- Duplicate analysis publishes detached normalized facts; it does not mutate
  source files or use `Photo.duplicateGroup` as authoritative state.
- No file paths, UXP entries, blob URLs, or host objects enter persisted
  duplicate/cache metadata.
- Content reads are bounded, cancellable, generation-aware, and never open
  Photoshop documents.
- Existing thumbnail/decode scheduling and workspace lifecycle boundaries remain
  authoritative.

## Delivery slices

### Slice 1 — Cache contract and deterministic lifecycle

- Characterize the existing 250-entry LRU behavior and alias ownership.
- Lock recency, replacement, eviction, clear, invalidation, and object-URL
  release behavior with deterministic tests.
- Expose detached cache statistics without keys, paths, URLs, or host values.
- Prove folder replacement and project close reject stale publications and
  release unowned resources.
- Decide whether an additional byte budget is required using measured evidence;
  do not infer blob memory from URL length.

### Slice 2 — Explainable exact-duplicate foundation

- Define a versioned, serializable duplicate-evidence schema.
- Use cheap normalized facts to form candidates before content reads.
- Verify exact duplicates with a deterministic content fingerprint.
- Process candidates sequentially or through the existing bounded scheduler.
- Publish stable group IDs, member photo IDs, evidence level, and byte-savings
  facts without persisting paths or file handles.
- Fail closed for unreadable, stale-generation, changed, or unsupported files.
- Do not delete, move, hide, reject, or automatically rate photos.

### Slice 3 — Library projection and operator UX

- Add duplicate-group filtering and explainable group/member summaries to the
  canonical Photo Browser projection.
- Preserve visible-order selection, rating, favourite, search, filtering,
  sorting, and virtualization behavior.
- Make incomplete, failed, and stale analysis explicit.
- Keep all duplicate decisions advisory and reversible.

### Slice 4 — Scale budgets and automated qualification

- Add deterministic synthetic fixtures for large libraries and duplicate sets.
- Measure enumeration, projection, metadata, fingerprint, cache, and visible
  rendering stages independently.
- Lock bounded concurrency, cache-entry ceiling, virtual-window ceiling, and
  zero Photoshop-document-open invariants.
- Run the complete test, architecture, regression, build, and package gates.

### Slice 5 — Photoshop/UXP runtime qualification

- Use disposable copied folders only.
- Verify cache reuse, refresh, folder replacement, project reopen, exact
  duplicate grouping, cancellation, and stale-work rejection.
- Record measured small/medium/large fixture results.
- Keep runtime PASS, automated PASS, limitations, and not-run scenarios
  distinct.

## Acceptance

1. Exact duplicate groups are deterministic, explainable, and content-verified.
2. Candidate analysis never treats filename, timestamp, dimensions, or size
   alone as proof of duplication.
3. Original photos are never modified, moved, deleted, hidden, or rejected.
4. Cache eviction and lifecycle release are deterministic and leak-safe.
5. Persisted facts contain no paths, UXP entries, blob URLs, or host objects.
6. Folder-generation changes cannot publish stale cache or duplicate results.
7. Large-library query/render/cache work remains bounded and measurable.
8. Photo Browser selection, ratings, favourites, filters, and sorting retain
   their canonical behavior.
9. No browser-quality workflow opens a Photoshop document.
10. Full automated/build/package gates and required Photoshop runtime scenarios
    pass with evidence kept distinct.

## Implementation status

- Existing cache: 250-entry recency-ordered `ThumbnailCache`.
- Existing lifecycle: alias tracking, invalidation, clear, object-URL ownership,
  workspace generations, and bounded decode scheduling.
- Existing telemetry: cache hits/misses/skips, cache timing, object URLs,
  decode counts, and thumbnail timing.
- Existing duplicate behavior: `Photo.duplicateGroup` placeholder only; no
  canonical duplicate-analysis service or persisted evidence.
- Slice 1 automated verification now covers the 250-entry runtime ceiling, LRU
  recency, replacement, eviction, shared ownership, active-consumer protection,
  safe detached statistics, stale-alias cleanup, per-photo invalidation,
  same-folder cache preservation, destructive lifecycle clearing, pending-work
  cancellation, and stale workspace-generation rejection.
- Slice 1 dedicated tests pass 13 scenarios, including the production-safe
  runtime summary contract. The complete automated suite,
  98-file architecture graph, 98/98 regression graph, and production build pass.
- A byte ceiling is not introduced in Slice 1: cached values are blob URLs, and
  URL string length is not evidence of retained byte size. Byte-budget work
  remains evidence-gated for the scale qualification slice.
- Slice 2 is complete: same-size candidate pruning precedes sequential binary
  reads; exact proof uses a locked pure-JavaScript SHA-256 implementation with
  no full-size padding copy. Evidence is normalized, bounded, immutable, and
  path-free. Library and member revision keys reject stale reuse.
- Duplicate persistence is coordinated only by `PhotoWorkspaceService`.
  Duplicate actions share one in-flight analysis, project/folder identity
  changes prevent publication, and persistence failure restores the previous
  evidence.
- Slice 3 is complete: the Photo Browser exposes **Find Duplicates**, explicit
  complete/partial/stale/not-run summaries, bounded group/member previews, and
  a persisted **Duplicates only** filter that composes with the existing
  search, metadata, rating, favourite, sorting, selection, and virtualization
  projection.
- Slice 4 is complete: a 10,000-photo fixture prunes to 200 sequential content
  reads, produces 100 deterministic groups, holds read concurrency at one,
  keeps the cache at 250 entries, retains bounded list/icon windows, and opens
  zero Photoshop documents. The full test, 98-file architecture, 98/98
  regression, hardening, production-build, and reproducible-package gates pass.
- Production `dist/index.js` remains inside the reviewed 550 KiB webpack
  ceiling.
- Slice 5 is complete. RT-01 through RT-04 passed in Photoshop 2026 using only
  disposable copied fixtures. Exact grouping/filtering, persistence and source-
  revision invalidation, active-workspace stale-result rejection, bounded cache
  reuse, idle queues, stable object-URL counts, and zero Photoshop documents
  opened by browser work are recorded in
  `ALB-061_PHOTOSHOP_UXP_RUNTIME_CHECKLIST.md`.
