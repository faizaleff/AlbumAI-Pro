# AlbumAI Pro — Canonical Domain Ownership

## Ownership rule

ALB-050 assigns one reachable source owner to each active state domain. An
owner defines the domain's canonical in-memory shape or lifecycle. Services,
policies, persistence adapters, UI projections, and Photoshop adapters may
operate on that state, but they must not introduce a competing aggregate.

The exact owner mapping is machine-enforced by
`Architecture/ALB-050_ARCHITECTURE_POLICY.json`.

| Domain | Canonical owner | Boundary |
| --- | --- | --- |
| Project | `src/core/ProjectEngine.js` | One open project: folder, workspace, and serializable metadata. `ProjectService` owns filesystem persistence, not a second project shape. |
| Photo | `src/services/PhotoWorkspaceService.js` | Photo-folder lifecycle, publication, refresh, thumbnail invalidation, and persistence coordination. `LibraryEngine` and `SelectionEngine` are scoped collaborators. |
| Template | `src/project/ProjectTemplateRegistry.js` | Ordered project-relative PSD descriptors and validation facts. Runtime document inspection remains in template services/adapters. |
| Placement | `src/placement/PhotoPlacementEngine.js` | Deterministic slot-to-photo assignment result. Execution consumes the result without redefining placement state. |
| Batch | `src/project/BatchExecutionService.js` | Single in-flight batch lifecycle and per-template outcome accounting. `ProjectExecutor` composes work around this owner. |
| Output Transaction | `src/project/OutputTransactionState.js` | Canonical commit, cancellation, reason, kind, and retry state vocabulary. Promotion/recovery policies transition or interpret this schema. |
| Recovery | `src/project/BatchRecoverySnapshot.js` | Immutable, serializable recovery checkpoint schema. UI and retry logic consume normalized snapshots. |

An Album is a bounded, ordered `metadata.album.sheets` collection within the
Project domain. Each Sheet references one registered Template by its durable
identifier; it is not a template document, a placement result, a render job,
or a Photoshop document. `AlbumSheetSchema` is the pure serialization boundary
used by `ProjectService`; `ProjectEngine` remains the sole aggregate owner.

ALB-081 extends each canonical Sheet with one versioned `design` value. Its
assignments contain only a positive Smart Object `slotLayerId`, an opaque
`p1-…` Photo key, and a normalized crop-focus point. `ManualSheetDesign` is the
pure validation and command boundary for assign, clear, swap, and crop-focus
changes; it is not a second Album owner. Template changes clear assignments
that belong to the prior PSD, and the existing bounded Album history provides
undo/redo for every accepted manual edit. Drag/drop UI and Photoshop mutation
remain orchestration and adapter concerns in later slices. The Slice 2
`manualDesignerModel` is a bounded, detached UI projection over the canonical
Sheet, registered Template descriptors, inspected runtime Template, and
published Photos. It retains no host objects or source paths, caps the rendered
Photo tray, and requires the inspected Template's in-memory project descriptor
identity to match the selected Sheet before exposing slots. Slice 3 interaction
helpers translate only allowlisted Photo/slot selections into the existing
assign, clear, and swap commands. `AppController` supplies current runtime
slot ids and opaque Photo keys to `ProjectService`; the UI never bypasses the
persist-before-publish or bounded Album history boundary. Slice 4 keeps crop
focus as a transient UI draft until explicit Apply, then emits the same bounded
`SET_CROP_FOCUS` command. Thumbnail and preview positioning consume the draft
or persisted point as a visual projection; they do not mutate Photoshop.
Slice 5 derives a short-lived `ManualSheetExecutionPlan` from that canonical
design only after the current Sheet request, registered template identity,
opened PSD Smart Object slots, and opaque Photo keys agree. The plan carries
only current runtime replacement facts and reuses the existing replacement
request, batch, Smart Object, transform, and clipping boundaries. Manual crop
focus is translated into a bounded fill offset that cannot expose an uncovered
slot edge; neither the execution plan nor the Sheet persists a host document
or file-entry reference.

## Orchestration boundary

`src/app/AppController.js` is the only active application orchestrator. It
constructs the owners and coordinates UI actions, but it is not an alternate
domain model. `ProjectExecutor` is the batch-use-case coordinator; it does not
own a second batch or recovery schema.

`src/services/PhotoBrowserModel.js` is a pure, deterministic projection over
the Photo owner's published collection. It normalizes persisted browser
preferences, filters and sorts without mutating Photo objects, and publishes
the exact visible order to selection. It does not retain or persist a competing
photo collection.

Per-photo rating and favourite decisions remain under
`PhotoWorkspaceService`. Persisted records use bounded opaque source hashes,
contain no paths or host entries, and are reconciled against the active
workspace before publication. `PhotoBrowserModel` consumes those records as a
read-only query input; it never writes decision fields onto Photo objects.

JPEG metadata enrichment also remains under `PhotoWorkspaceService`. Reads
share the bounded browser decode scheduler, and only normalized dimensions,
orientation, and Date Taken facts may be published by the current folder
generation or written to the metadata cache.

Exact-duplicate evidence also remains under `PhotoWorkspaceService`. Candidate
pruning uses normalized byte size, while duplicate proof requires a sequential
full-content SHA-256 fingerprint. Persisted evidence contains only bounded
opaque photo/revision/group keys, evidence level, byte counts, and safe failure
reasons. A library revision change invalidates the complete result; duplicate
analysis never mutates, moves, deletes, hides, rejects, or rates a Photo.

AI capability, consent, and per-photo evidence policy also remain under
`PhotoWorkspaceService`. `PhotoAiPolicy` is a pure local-only contract and
normalizer used by that owner; it is not an inference engine or parallel photo
aggregate. Remote inference is fixed off, public-safe projections exclude
source or host references, and machine evidence cannot mutate ratings,
favourites, or future keep/reject decisions. Model execution remains gated on
the ALB-070 UXP WebAssembly feasibility and commercial-licensing decision.

The deleted inactive source contained competing project models, album engines,
template registries, generation contexts, workflow jobs, export managers,
bootstrap containers, and UI state stores. None is part of the product after
ALB-050, and no feature claim may cite it.

## Photoshop adapter boundary

Active domain code reaches Photoshop only through these explicit adapters:

- `src/core/document/DocumentManager.js` — open, save, export, and close;
- `src/core/album/SmartObjectService.js` — Smart Object replacement operations;
- `src/core/album/LayerBoundsService.js` — layer geometry reads;
- `src/core/album/LayerTransformService.js` — layer transform writes;
- `src/core/photoshop/ExecuteModal.js` — modal execution boundary;
- `src/core/photoshop/BatchPlay.js` — low-level BatchPlay boundary.

`Logger`, `Constants`, `ErrorHandler`, and the reachable `core/layers` files are
support code, not alternate domain owners. Inactive Photoshop, smart-object,
document, and export stacks were deleted instead of being retained as competing
implementations.

## Change rule

New state must extend the named owner or introduce a reviewed migration that
updates the policy, graph verification, tests, and this document together. A
new bootstrap, parallel manager/facade/engine, or unreachable feature stack is
an architecture failure.
