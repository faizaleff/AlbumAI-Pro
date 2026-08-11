# ALB-060 — Photo Library Search, Filter, Sort, and Metadata UX

## Goal

Complete the canonical Photo Browser discovery workflow without introducing a
second photo library, mutating source photos, or weakening the existing bounded
thumbnail pipeline.

## Architecture boundary

- `PhotoWorkspaceService` remains the Photo domain owner.
- `LibraryEngine` remains the authoritative in-memory photo collection.
- `PhotoBrowserModel` is a pure browser projection plus the canonical
  filtered-order selection bridge; it does not own a second collection.
- Browser preferences are normalized, versioned, serializable project metadata.
- Filtering and sorting never replace or mutate Photo objects.
- Thumbnail virtualization receives only the projected ordered result.

## Delivery slices

### Slice 1 — Deterministic browser projection

- Normalize legacy sort and versioned browser preferences.
- Add bounded filename search, type/orientation filters, and stable sorting.
- Keep Select All, range selection, focus, and keyboard navigation aligned with
  the visible result order.
- Distinguish an empty folder from zero matching results.
- Add result counts and deterministic query tests.

### Slice 2 — Metadata decision persistence

- Define a versioned per-photo decision cache keyed by stable source identity.
- Persist rating and favourite without modifying originals.
- Reconcile decisions across refresh and remove stale identities safely.
- Add rating/favourite controls and filters.

### Slice 3 — Bounded metadata extraction

- Publish dimension/orientation and supported date facts through the existing
  photo workspace lifecycle.
- Bound concurrent reads and cancel stale folder generations.
- Persist only normalized metadata facts; never paths, entries, or host objects.

### Slice 4 — Complete filter UX

- Add date presets and metadata-aware sort fields.
- Add filter summary, clear action, accessible labels, and compact empty states.
- Preserve preferences per project without corrupting project activation.

### Slice 5 — Scale and runtime qualification

- Verify deterministic behavior on large synthetic libraries.
- Prove virtualized rendering and thumbnail queue work only on visible results.
- Run the complete automated/build/package gates.
- Request Photoshop/UXP runtime evidence only for host-specific behavior.

## Acceptance

1. Search is case-insensitive, bounded, and filename-only.
2. Filters compose deterministically and expose total/matched/hidden counts.
3. Every sort has deterministic name/id tie-breaking and null values sort last.
4. Select All and range selection operate on the visible projected order.
5. Preferences normalize malformed persisted input and remain serializable.
6. Photo objects, source entries, and originals are never mutated by queries.
7. No new competing manager, store, bootstrap, or unreachable feature stack is
   introduced.

## Implementation status

- Slice 1 is implemented with automated coverage for normalization, composed
  filters, stable/null-last sorting, facets, immutability, and empty-result
  selection behavior.
- The UI exposes filename search, type/orientation/date filters, extended sort,
  matched/total counts, and a clear-filters action. Preferences migrate from
  the legacy sort field and persist as schema-versioned project metadata.
- Slices 2–5 remain intentionally open; runtime qualification will be requested
  only after metadata decisions and extraction are complete.
