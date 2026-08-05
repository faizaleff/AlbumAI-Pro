# ALB-044 — Template Registry Preflight and Missing-PSD Recovery

Status: **PLAN ONLY — no production implementation in this slice**
Base: `main` at `15b1c41`
Branch: `feature/alb-044-template-registry-preflight`

## Objective

Make a project's registered PSD template set trustworthy before a batch starts.
AlbumAI must validate project-owned template entries on project open and at the
defined mutation/preflight boundaries, show a deterministic per-template result,
and refuse to start a project batch when the registry cannot be resolved
safely. Basic validation must never open a Photoshop document.

## Current repository evidence

### Active ownership and call path

- `src/index.jsx` mounts `AlbumBrowser`, which mounts `OpenFolder`; the active
  runtime is not the alternative `src/core/album`, `src/engine`, or broad
  `src/services` architectures.
- `AppController.openProject()` loads metadata through `ProjectService`, creates
  `ProjectTemplateRegistry(project.metadata.templateRegistry)`, then loads batch
  recovery. It currently performs no registry validation.
- `ProjectTemplateRegistry` is the ordered, serializable descriptor collection.
  Its descriptor stores `id`, project-relative `fileReference`/`fileName`,
  `registrationOrder`, and `validationState`; `add()` defaults to `UNKNOWN`.
- `TemplateDocumentReader.listTemplates()` enumerates the active project's
  `Templates` folder. `resolveRegisteredTemplate()` searches by native path or
  file name and throws only when no entry is found. It opens a document through
  `read()` after it chooses an entry.
- The registered-template UI already renders a status badge, but currently
  maps only `VALID` to `READY`; it has no revalidate action or remediation
  model.
- `executeProject()` calls `beginRecoverySnapshot()` before `ProjectExecutor`
  invokes `resolveTemplate()`. Therefore a missing template can currently
  mutate recovery before the failure is discovered and can open PSD documents
  before registry-wide validation is complete.
- `registryRecoveryVersion()` is currently ordered `id:fileReference` data.
  `loadRecovery()` classifies a version mismatch as `STALE`, but it does not
  separately express template availability/validation compatibility.
- `ProjectService.saveProject()` mutates `ProjectEngine` metadata before its
  atomic write. A registry-validation workflow must explicitly restore its
  prior in-memory registry/metadata state if persistence fails.

### Prior milestone and roadmap evidence

- ALB-043 completed transactional photo-folder replacement, including atomic
  project persistence, explicit recovery clearing, rollback, and Photoshop
  runtime verification. This milestone must not regress those boundaries.
- The v1.0.1 roadmap explicitly lists missing-template recovery across reloads,
  invalid/unreadable PSD handling, startup validation, and failed-template retry
  consistency as outstanding priorities.
- Current automated tests cover ALB-043 folder changes only. There is no
  deterministic template-registry open/reopen/preflight test suite.

## Problem statement

A user can add a PSD to a project's registry, save, close, and later reopen
the project without learning that the PSD has been removed, renamed, duplicated
ambiguously, or cannot be inspected. The current batch path discovers a missing
file only while resolving templates after it has created recovery state.

That is too late: the user needs a clear actionable status before Process
Project, and recovery must not be silently destroyed just because a template is
temporarily unavailable.

## Terminology and basic state model

### Registered template descriptor

The durable, ordered project metadata entry owned by `ProjectTemplateRegistry`.
Its `id`, `fileReference`, and `registrationOrder` establish registry identity
and order. Validation adds observation; it does not replace that identity.

### Basic validation

Folder-entry inspection only. It enumerates the active project's `Templates`
folder and matches descriptors without opening a Photoshop document, reading
PSD structure, detecting Smart Objects, or modifying template contents.

### Validation states

| State | Exact meaning | Blocking | Deterministic reason |
| --- | --- | --- | --- |
| `READY` | Exactly one PSD entry matches the descriptor in the active project `Templates` folder. | No | `A unique project PSD is available.` |
| `MISSING` | No PSD entry matches the descriptor. | Yes | `The registered PSD is not in this project's Templates folder.` |
| `AMBIGUOUS` | More than one candidate matches and safe identity resolution is impossible. | Yes | `More than one project PSD matches this registration.` |
| `ACCESS_ERROR` | A matching entry exists, but the storage API cannot inspect it sufficiently to establish a safe basic result. | Yes | `AlbumAI could not inspect the registered PSD.` |

`UNKNOWN` is allowed only for legacy/on-disk descriptors before the first
successful validation attempt. It is a blocking transitional state and must be
rendered as `Needs validation`, not as ready.

`VALID`, `SLOTLESS`, `STRUCTURALLY_UNREADABLE`, and similar states are **not**
basic-startup states. A PSD may require controlled opening for structural
analysis; that belongs to an explicit future deep-validation action or the
existing batch-analysis path.

### Matching rules

1. Inspect only immediate PSD file entries in the active project's `Templates`
   workspace folder.
2. Match the durable project-relative `fileReference` exactly under the
   project-defined comparison policy, with `fileName` only as legacy
   compatibility input—not an unsafe tie breaker.
3. Zero candidates is `MISSING`; one candidate is `READY`; more than one is
   `AMBIGUOUS`.
4. If the folder or candidate cannot be enumerated/inspected through the UXP
   storage API, return `ACCESS_ERROR` for the affected descriptor(s), retaining
   a bounded non-sensitive reason.
5. Never choose an arbitrary candidate, native path, or external file.

## Authoritative data ownership

| Data | Owner | Persistence | Notes |
| --- | --- | --- | --- |
| Descriptor identity and order | `ProjectTemplateRegistry` | `project.json.templateRegistry` | Authoritative input for execution and recovery versioning. |
| Project `Templates` folder entries | `ProjectService`/UXP storage workspace | Filesystem | Authoritative source for basic availability. |
| Basic validation result | Registry descriptor validation fields | `project.json.templateRegistry` | A persisted observation with `state`, `reasonCode`, and validation revision/time; never an identity replacement. |
| Current opened PSD and deep analysis | `TemplateDocumentReader` and transient `TemplateRegistry` | Session only | Not used by startup validation. |
| Batch recovery snapshot | `AppController` / `BatchRecoverySnapshot` | `project.json.batchRecovery` | Remains separate; registry compatibility is classified, not silently cleared. |

Proposed descriptor extension (names are intentionally provisional):

```js
{
  id,
  name,
  fileReference,
  fileName,
  registrationOrder,
  validation: {
    state: "READY" | "MISSING" | "AMBIGUOUS" | "ACCESS_ERROR" | "UNKNOWN",
    reasonCode: "UNIQUE_MATCH" | "NO_MATCH" | "MULTIPLE_MATCHES" | "STORAGE_INSPECTION_FAILED" | "NOT_VALIDATED",
    validatedAt: "ISO-8601 timestamp" | null,
    validationRevision: 1
  }
}
```

The serializer should normalize legacy `validationState` into this shape without
changing IDs, references, or order. `registrationOrder` remains authoritative;
validation must never reorder descriptors.

## Service, controller, and UI boundaries

### New focused service: `TemplateRegistryPreflightService`

Owns only deterministic basic inspection:

- enumerate `project.workspace.templates` once per pass;
- derive candidate sets and outcomes in registry order;
- return immutable result objects with no host Entry, native path, or token in
  user-facing reason data;
- never call `DocumentManager.open`, `TemplateDocumentReader.read`, Photoshop
  DOM APIs, or the batch executor.

It may use `TemplateDocumentReader.listTemplates()` only if that method remains
strictly folder enumeration; a dedicated lower-level entry-list method may be
clearer. It must not call `resolveRegisteredTemplate()`.

### `ProjectTemplateRegistry`

Owns applying a complete result set by descriptor ID while preserving identity
and order. It should expose immutable snapshots/replacement helpers so a
controller can restore an exact pre-mutation state after save failure.

### `AppController`

Orchestrates the pass at these required boundaries:

1. after project open and before initial recovery presentation;
2. after template registration;
3. after template removal;
4. after restoration/replacement through explicit revalidate;
5. when the user selects **Revalidate Templates**;
6. immediately before `Process Project`, before `beginRecoverySnapshot()`,
   `ProjectExecutor.execute()`, or `TemplateDocumentReader` document opening.

It owns persistence transactions, process blocking, and the separate recovery
compatibility classification. It does not infer structural PSD health from a
basic result.

### `TemplateDocumentPanel`

Renders each state and remediation action. It requests a controller-owned
operation; it does not enumerate files or edit registry state itself. Process
Project should be disabled when a current blocking result is known, but the
controller preflight remains the authoritative race-safe guard.

## Transaction and rollback design

### Validation-only transaction

1. Capture `registryBefore = projectTemplateRegistry.toJSON()` and complete
   metadata needed to restore the in-memory project.
2. Run one basic preflight pass against the project workspace.
3. Build a proposed registry snapshot by applying outcomes by stable descriptor
   ID; preserve order exactly.
4. Compute recovery compatibility from registry identity/order independently of
   availability state.
5. Save the proposed registry and unchanged recovery snapshot through the
   existing atomic project save path.
6. Only after a verified save, publish the proposed registry snapshot and UI
   refresh. If current `ProjectService.saveProject()` necessarily mutates
   metadata earlier, explicitly restore both metadata and registry snapshot on
   failure.

There is no photo workspace, thumbnail, placement, execution, cache, or
Photoshop document mutation in validation-only work.

### Registry mutation transaction

Add/remove/reorder uses the same snapshot pattern:

1. validate mutation eligibility (no batch and no registry transaction);
2. capture exact pre-mutation registry/metadata/recovery state;
3. form proposed registry; then run basic validation for the resulting set;
4. classify recovery compatibility; do not clear it implicitly;
5. atomically persist proposed registry and preserved recovery;
6. publish only after success, otherwise restore all in-memory state.

Replacement/restoration means the user changes the project-owned PSD entries
outside AlbumAI or replaces a registration through a future explicit UI; this
slice handles it through revalidation rather than external paths or guessing.

### Process Project preflight ordering

`executeProject()` must first run/await basic preflight and reject with a
machine-readable `TEMPLATE_REGISTRY_BLOCKED` result/error when any entry is
not `READY` (including unvalidated legacy `UNKNOWN`). This happens before:

- `beginRecoverySnapshot()`;
- `projectBatchRunning = true`;
- recovery writes or metadata mutations;
- `ProjectExecutor.execute()`;
- `resolveRegisteredTemplate()` and any Photoshop document opening.

The rejection must leave prior recovery unchanged and expose affected template
names/statuses without paths or tokens.

## Recovery compatibility policy

Availability is not identity. A descriptor becoming `MISSING`, `AMBIGUOUS`, or
`ACCESS_ERROR` does **not** clear a recovery snapshot.

| Condition | Recovery classification | Action |
| --- | --- | --- |
| Same ordered descriptor IDs/references; all `READY` | Existing lifecycle classification | Resume/retry eligibility follows current policy. |
| Same ordered identities; one or more blocking basic states | `BLOCKED_TEMPLATE_REGISTRY` | Retain and persist recovery unchanged; show why resume/retry cannot start. |
| Descriptor ID/reference/order differs from snapshot `registryVersion` | `STALE_REGISTRY` | Retain snapshot, disable resume/retry, require explicit user policy. |
| Snapshot schema/newer project mismatch | Existing `INCOMPATIBLE` policy | Retain snapshot; no silent clear. |

An explicit future **Discard Recovery** action may clear recovery only after
user confirmation and an atomic project save. This milestone may document and
surface that policy, but should not broaden into a new recovery-management
redesign unless needed for blocking remediation. Revalidation itself must never
invoke recovery clearing.

The recovery version remains based on ordered descriptor identity/reference,
not the volatile basic validation timestamp. Whether to include a deliberate
descriptor replacement generation in that version is an unresolved question.

## API proposal

Names are proposals to validate during implementation; APIs must inspect actual
tests and host constraints before finalizing.

```js
// src/services/TemplateRegistryPreflightService.js
async validate({ workspaceTemplates, descriptors })
// => Object.freeze({
//      status: "COMPLETE" | "ACCESS_ERROR",
//      results: [{ templateId, state, reasonCode }],
//      blockingTemplateIds: [],
//      inspectedAt
//    })

// src/project/ProjectTemplateRegistry.js
snapshot()
withValidationResults(results)
blockingEntries()

// src/app/AppController.js
async revalidateProjectTemplates({ reason = "EXPLICIT" } = {})
getTemplateRegistryPreflightState()
async addCurrentPsdToProject(file) // becomes add -> validate -> persist transaction
async executeProject(onUpdate, options = {}) // preflight before recovery checkpoint
```

`revalidateProjectTemplates()` should return a detached status object suitable
for the panel, including `READY`/blocking counts and safe remediation details.
It should reject only operational failures that make no coherent result
possible; individual inaccessible entries should be represented as
`ACCESS_ERROR` outcomes where possible.

## UI states and copy

| State | Row label | Suggested copy | Action |
| --- | --- | --- | --- |
| `READY` | Ready | `A unique project PSD is available.` | None required. |
| `MISSING` | Missing | `Add or restore this PSD in the project's Templates folder, then revalidate.` | Revalidate; Remove registration. |
| `AMBIGUOUS` | Ambiguous | `More than one PSD matches this registration. Remove or rename duplicates, then revalidate.` | Revalidate; Remove registration. |
| `ACCESS_ERROR` | Cannot inspect | `AlbumAI could not inspect this PSD. Check project-folder access, then revalidate.` | Revalidate. |
| `UNKNOWN` | Needs validation | `Template validation has not completed.` | Revalidate. |

Panel additions:

- a keyboard-accessible **Revalidate Templates** action, disabled during a
  registry transaction or active batch;
- a concise registry summary, for example: `2 ready · 1 missing — Process
  Project is unavailable`;
- blocking reason list near Process Project;
- Process Project disabled for current blocking state, with controller-level
  preflight still mandatory when stale UI permits a click;
- no paths, persistent tokens, raw storage errors, or PSD contents in UI/log
  messages.

## Test architecture

Extend the existing Node/webpack-compatible focused harness rather than adding
a broad test framework in this slice.

### Deterministic service/registry tests

- unique entry produces `READY`;
- no candidate produces `MISSING`;
- duplicate matching candidates produce `AMBIGUOUS` and no chosen entry;
- storage-entry inspection failure produces `ACCESS_ERROR`;
- legacy `UNKNOWN` normalization is blocking;
- result application preserves descriptor IDs, references, and order;
- results contain no native paths/tokens in public reason data.

### Controller transaction tests

- project open validates before presenting recovery state;
- add/remove/reorder/revalidate persists coherent outcomes;
- save failure restores exact registry and project metadata in memory;
- Process Project rejects before `beginRecoverySnapshot`, recovery write,
  `ProjectExecutor.execute`, or document-reader resolve;
- restored PSD plus revalidate returns the entry to `READY`;
- identity/order change marks recovery stale while missing availability alone
  retains a blocked recovery snapshot.

### UI contract tests

- row labels/reasons and aggregate blocking copy;
- Revalidate control loading/disabled behavior;
- Process Project disabled state plus controller rejection fallback;
- remediation actions preserve registry selection/order.

### Regression checks

`npm test -- --runInBand`, `npm run build`, and `git diff --check`, including
the existing ALB-043 folder-change suite.

## Photoshop/UXP runtime matrix

The companion `ALB-044_RUNTIME_VERIFICATION.md` is the authoritative manual
matrix. Validation-only checks must demonstrate zero PSD document opens;
deep/batch analysis may open documents only after a READY preflight.

## Implementation slices

1. **Contract and data model** — add constants/normalization, immutable
   registry snapshot/result application, and deterministic pure tests.
2. **Basic preflight service** — enumerate project-owned entries and implement
   READY/MISSING/AMBIGUOUS/ACCESS_ERROR without Photoshop DOM access.
3. **Controller transactions** — open/mutation/revalidate orchestration,
   atomic persistence rollback, process-project ordering guard, and recovery
   classification.
4. **Panel remediation** — per-row labels/reasons, summary, revalidate action,
   process blocking feedback, and accessibility checks.
5. **Verification closeout** — test harness, build/regression results, and all
   runtime matrix evidence.

## Risks

- UXP entry metadata may not provide sufficient stable identity beyond name;
  ambiguous matching must fail closed rather than guess.
- ProjectService currently mutates memory before writing; transaction code must
  restore exact metadata/registry values after a write or verification failure.
- Revalidating on every process click introduces I/O; keep it one bounded folder
  enumeration and never open each PSD.
- Registry mutation while recovery exists can change order/identity; state must
  remain retained and explicitly classified rather than cleared.
- Existing batch analysis currently writes `VALID`/`MISSING`; migrate that
  update carefully so deep analysis does not overwrite the basic-state model.

## Non-goals

- Placement algorithm changes.
- PSD repair or automatic template migration.
- Auto Save/export redesign.
- Broad model or alternate-architecture consolidation.
- External template paths.
- Deep Smart Object inspection, slotlessness detection, or structural PSD
  validation during startup.

## Acceptance criteria

1. On project open, every registered descriptor has a basic result generated
   from project-owned `Templates` entries without opening Photoshop documents.
2. The exact READY/MISSING/AMBIGUOUS/ACCESS_ERROR definitions in this plan are
   implemented, deterministic, non-sensitive, and blocking except READY.
3. Revalidation runs at all six required boundaries.
4. Registry identity and order remain authoritative and unchanged by validation.
5. Any blocking result stops Process Project before checkpoint/recovery mutation
   or PSD open.
6. The UI shows state, reason, and actionable remediation for each entry.
7. Validation persistence survives close/reopen; a save failure restores the
   prior in-memory registry/validation state and metadata.
8. Missing/ambiguous/access-error results never silently clear recovery;
   recovery compatibility is separately surfaced and persisted only by explicit
   policy.
9. Focused automated tests, ALB-043 regressions, production build, diff check,
   and all ALB-044 runtime scenarios pass before merge.

## Commit strategy

Keep commits reviewable and independently testable:

1. `test(alb-044): characterize template registry preflight contracts`
2. `feat(alb-044): add basic template registry preflight`
3. `feat(alb-044): block project processing on invalid template registry`
4. `feat(alb-044): add template validation remediation UI`
5. `docs(alb-044): record runtime verification`

Do not change `dist/index.js` in any slice. Do not commit this plan-only slice
automatically.

## Unresolved design questions

1. Does the UXP storage API expose a stable project-relative identity that can
   replace filename-only `fileReference` without breaking existing projects?
2. When a descriptor is intentionally replaced with a same-name PSD, should a
   persisted replacement generation be added to recovery compatibility, or is
   explicit user acknowledgement sufficient?
3. Should `ACCESS_ERROR` apply per descriptor when one file cannot be inspected,
   or globally when `Templates.getEntries()` itself fails? The implementation
   should preserve the most specific coherent result possible.
4. Does explicit Revalidate persist timestamps/outcomes every time, or only when
   state/reason changes? Prefer avoiding needless project writes if runtime UX
   remains coherent.
5. What explicit recovery-clear UI/policy already exists and can be reused for
   a future `STALE_REGISTRY` resolution without expanding ALB-044?
