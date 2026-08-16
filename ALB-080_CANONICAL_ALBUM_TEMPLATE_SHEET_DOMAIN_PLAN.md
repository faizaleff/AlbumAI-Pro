# ALB-080 — Canonical Album, Template, and Sheet Domain Plan

Status: **IN PROGRESS — Slices 1–5 implementation in progress; runtime qualification pending**

Slice 5 exposes an explicit `Render Sheet: <label>` action only after a Sheet
is selected. It creates a detached render request from the current Sheet and
opaque photo IDs, revalidates that request immediately before execution, and
then delegates to the existing project-batch, output, and recovery path. It
does not render automatically.

Baseline: **`origin/main` at `20241ee`**

## Goal

Establish one versioned, serializable Album Designer domain before introducing
manual sheet editing, story ordering, drag and drop, or layout suggestions.

The current product already owns project metadata, ordered PSD template
descriptors, deterministic placement, batch execution, output transactions,
and recovery. ALB-080 must connect those facts through one canonical project
model; it must not reactivate the removed alternate album/engine stack or
introduce a second template registry.

## Current canonical facts

| Concept | Current owner | Current meaning |
| --- | --- | --- |
| Project | `ProjectEngine` | One open project, workspace, and serializable metadata |
| Template | `ProjectTemplateRegistry` | Ordered project-relative PSD descriptor plus validation facts |
| Photo | `PhotoWorkspaceService` | Active photo-library lifecycle, opaque decisions, and published facts |
| Placement | `PhotoPlacementEngine` | Deterministic slot-to-photo assignment for one execution |
| Batch | `BatchExecutionService` | One in-flight execution and template outcome accounting |
| Output transaction | `OutputTransactionState` | Safe save/export commit and retry vocabulary |
| Recovery | `BatchRecoverySnapshot` | Detached serializable batch checkpoint |

`src/services/TemplateRegistry.js` is not the canonical persisted-template
owner. ALB-080 must not make it an Album Designer dependency.

## Canonical vocabulary

| Term | Definition | Must not mean |
| --- | --- | --- |
| Album | A versioned, project-scoped ordered collection of Sheets and album-level presentation metadata | A second project, a Photoshop document, or an output job |
| Sheet | One user-visible album position that references one registered PSD template and stores bounded layout intent | A duplicate PSD file, an opened Photoshop document, or a batch result |
| Template | A registered project-relative PSD descriptor with validation state | A Sheet, album page, export file, or live document |
| Slot | A stable Smart Object target discovered from one template at execution time | A Photo, a persisted host layer reference, or a global layout object |
| Placement | A transient deterministic assignment from selected photos to slots | A user decision or a replacement batch |
| Render / export job | A bounded execution request and its output transaction facts | The Album or Sheet source of truth |

## Persistence boundary

The future Album payload belongs inside canonical project metadata and must be
public-safe and serializable. It may contain opaque IDs, ordering, bounded
labels, template IDs, template compatibility/version facts, slot intent, and
detached edit metadata. It must not contain:

- UXP entries, persistent tokens, filesystem paths, native paths, URLs, or
  Photoshop document/layer objects;
- source pixels, image buffers, blob URLs, raw EXIF, face data, embeddings, or
  AI model evidence;
- duplicate Photo collections, user ratings/favourites, or future keep/reject
  decisions;
- rendered PSD/JPEG output as authoritative Sheet state.

Existing `project.json` validation currently accepts only schema version 1.
ALB-080 must add an explicit atomic migration pipeline before any new required
persisted field is written. A newer unknown project schema must remain blocked
without fallback to an older backup.

## Required invariants

1. A Sheet references a registered Template by stable descriptor ID; it never
   stores a native path or a live Photoshop document identity.
2. Removing or invalidating a Template makes dependent Sheets explicit and
   non-renderable; it never silently substitutes a similarly named PSD.
3. Reordering Sheets or Templates is deterministic, immutable, and preserves
   stable Sheet IDs.
4. Album changes cannot mutate source photos, ratings, favourites, duplicate
   evidence, AI evidence, or existing output transaction history.
5. A render request consumes a detached Album/Sheet snapshot and publishes
   output/recovery facts through the existing Batch and Output owners.
6. Browser selection order remains authoritative for future manual placement;
   no Album Designer collection becomes a second Photo library.
7. A stale project, template registry, photo revision, or active-request
   identity cannot publish an apparently-current Sheet/render result.
8. All migration, validation, serialization, and UI-projection failures fail
   closed with bounded reason codes.

## Delivery slices

### Slice 1 — Schema and migration envelope

- Define `Album`, `Sheet`, and Sheet-template reference schemas as pure,
  frozen, serializable values.
- Add exact validation and allowlisted reason codes for malformed, duplicate,
  stale, missing, invalid, and unsupported references.
- Add an atomic v1-to-v2 project migration path that preserves existing
  `templateRegistry`, photo metadata, duplicate evidence, browser preferences,
  batch recovery, and unknown compatible optional metadata.
- Keep project schema upgrades and write recovery in `ProjectService`; keep
  in-memory project ownership in `ProjectEngine`.
- Add migration/idempotency/rollback/newer-schema tests before UI work.

### Slice 2 — Template-to-Sheet compatibility policy

- Add a pure policy that resolves Sheet template IDs exclusively through
  `ProjectTemplateRegistry` snapshots.
- Define explicit Sheet states such as `READY`, `MISSING_TEMPLATE`,
  `TEMPLATE_BLOCKED`, `STALE_TEMPLATE`, and `UNSUPPORTED_SCHEMA`.
- Prove Template remove/reorder/validation changes cannot retarget the wrong
  Sheet.
- Add detached Sheet summaries for UI and diagnostics with no host data.

### Slice 3 — Album mutation and history contract

- Define immutable add, remove, rename, reorder, duplicate, and restore
  operations for Sheets.
- Choose one bounded undo/redo representation that persists only user intent,
  not Photoshop documents or rendered output.
- Coordinate serialized saves through `ProjectService`; persistence failure
  restores the prior Album snapshot and leaves the active UI coherent.
- Keep this slice UI-independent and lock it with deterministic tests.

### Slice 4 — Manual designer projection

- Build an accessible Album/Sheet projection from canonical project metadata.
- Support story order, Template selection, visible compatibility state, and
  safe empty/blocked states.
- Reuse Photo Browser selection and existing template validation state; do not
  clone either collection.
- Introduce drag/drop only after keyboard-accessible deterministic mutations
  and undo/redo pass automated tests.

### Slice 5 — Render bridge and qualification

- Translate a detached Sheet snapshot into the existing placement/execution
  request without making the Sheet a second batch owner.
- Reuse transactional save/export and recovery facts; never create direct
  overwrite behaviour.
- Measure cancellation, stale rejection, output recovery, bounded memory, and
  no-document-leak behaviour with disposable fixtures.
- Run the full automated, build, package, and Photoshop/UXP runtime matrix.

Slice 5 first introduces a detached `AlbumSheetRenderRequest`. It snapshots a
single canonical Sheet, the compatible registered Template validation facts,
and the authoritative browser selection order. It deliberately contains no
file reference, photo object, or Photoshop document identity. Photo IDs remain
opaque so the existing photo owner can keep using its current host-backed ID
format without adding photo metadata to the request.
Immediately before execution the request is rebuilt from current project,
Album, registry, and selection facts. Any mismatch fails closed as a bounded
project, Sheet, registry, or photo-selection stale reason. A valid request is
then passed as a one-template call to the existing `executeProject` / batch,
output, and recovery owners; it does not introduce an Album-owned renderer.

## Explicit non-goals

- AI layout suggestions, automatic design, culling, image editing, or remote
  inference;
- a new Photoshop document manager, template reader, output exporter, batch
  executor, Photo library, or global state store;
- source-photo edits, deletion, movement, hiding, automatic ratings, or
  automatic keep/reject decisions;
- importing unvalidated PSDs directly into a Sheet or silently resolving a
  missing template by filename.

## Initial verification gates

- deterministic schema normalization, serialization, and migration tests;
- current-project compatibility, invalid/malformed input, atomic rollback, and
  newer-schema rejection tests;
- template removal/reorder/preflight invalidation tests;
- active architecture and regression graph verification;
- full test suite, production build, package validation, and `git diff --check`;
- separate Photoshop/UXP scenarios only once a render bridge exists.

## Implementation decision

ALB-080 Slices 1–2 add the migration envelope, canonical empty Album schema,
and detached compatibility resolver that binds Sheets to registered template
IDs without increasing the module graph. Slices 3–4 add bounded persisted
Sheet history plus a keyboard-accessible UXP projection for add, remove,
rename, duplicate, deterministic move, undo, and redo. No drag/drop, render
bridge, or new persisted fields are introduced.

## Slice 3 implementation contract

Slice 3 keeps its mutation and persistence core UI- and Photoshop-independent.
It accepts a detached canonical Album and produces a new frozen Album; it never
mutates its input. A matching ProjectService adapter writes the accepted
snapshot first and only then updates in-memory project metadata, preserving the
prior Album/history on write failure. The guarded UI integration invokes only
that adapter and blocks every Sheet command while a project batch is running
or stopping safely.
The only permitted mutation intents are:

| Intent | Required input | Safe result | Rejected when |
| --- | --- | --- | --- |
| `ADD` | stable Sheet ID and registered Template ID | Append one Sheet | ID invalid/duplicate or Album full |
| `REMOVE` | stable Sheet ID | Remove exactly that Sheet | Sheet is absent |
| `RENAME` | stable Sheet ID and bounded non-empty label | Change only that label | Sheet/label invalid |
| `MOVE` | stable Sheet ID and target position | Deterministic reordered list | Sheet/position invalid or no-op |
| `DUPLICATE` | source Sheet ID and new stable Sheet ID | Copy only serializable Sheet intent | Source absent or new ID duplicate |
| `RESTORE` | previously captured canonical Album snapshot | Replace with that validated snapshot | Snapshot invalid or incompatible |

`ADD` and `DUPLICATE` do not prove that a Template is renderable. The Slice 2
compatibility resolver remains the sole source of `READY`/blocked state. A
Template removal therefore leaves a Sheet reference explicit rather than
retargeting it or deleting user intent.

History stores at most **20** prior frozen Album snapshots and a matching
forward stack. It stores no paths, file entries, Photoshop objects, pixels,
photos, placement results, outputs, batch snapshots, or AI evidence. A new
successful mutation clears forward history. No-op and rejected intents never
alter history.

Persistence is a serialized `ProjectService.saveProject({ album })` operation.
The in-memory project metadata is updated only after the proposed Album passes
validation. On persistence rejection, the caller restores the previous frozen
Album and its prior history cursor; no partial Sheet state is published. An
active batch will block future UI mutation commands, but that integration is
reserved for the UI slice.

### Bundle boundary

The production bundle is now **555,903 bytes** against the enforced **573,440
byte** limit, leaving **17,537 bytes** of headroom. This was achieved by
replacing the full Node-style `buffer` polyfill with the narrowly scoped typed
array byte-buffer surface used by `jpeg-js`; JPEG encoding and decoding are
covered by a production-alias smoke test. Slice 3 must preserve this ceiling
and may not hide capability changes inside further optimisation work.
