# ALB-044 Runtime Verification — Template Registry Preflight and Missing-PSD Recovery

Status: **COMPLETE — implementation and runtime validation closed at `91796e4`**
Branch: `feature/alb-044-template-registry-preflight`
Base: `main` at `15b1c41`
Final implementation HEAD: `91796e4`

## Runtime contract

Basic project-open/template-registry validation inspects only entries in the
active project's `Templates` folder. It must not open a Photoshop PSD document,
perform Smart Object inspection, create a batch checkpoint, mutate recovery, or
start a batch.

Basic states are exact:

- `READY`: exactly one matching PSD exists.
- `MISSING`: no matching PSD exists.
- `AMBIGUOUS`: more than one candidate matches and no safe identity resolution
  is possible.
- `ACCESS_ERROR`: a matching entry exists but cannot be inspected through the
  storage API.

`SLOTLESS` and structural/unreadable PSD classifications are not startup
validation outcomes. They require controlled PSD opening and remain outside
this matrix except where an existing batch-analysis path is intentionally
tested after a READY preflight.

## Test setup

Record before every scenario:

- Photoshop and UXP versions;
- plugin commit/build identifier;
- project fixture name and registered-template order;
- `project.json` copy or checksum before/after where persistence is exercised;
- current recovery state and batch id, if any;
- open document count/reference snapshot, when the host exposes it.

Use isolated project fixtures. Template names below are examples only and must
not be emitted as persistent paths/tokens in diagnostics.

Expected validation-only invariants:

```text
PSD documents opened by basic validation: 0
Batch checkpoint writes: 0, unless a later valid Process Project begins
Recovery mutation: 0, unless the user explicitly invokes a persisted recovery policy
Registry order: unchanged by validation
```

## Scenario matrix

| ID | Scenario | Status |
| --- | --- | --- |
| RT-01 | Valid registry on project open | PASS |
| RT-02 | Missing PSD on reopen | PASS |
| RT-03 | Restored PSD plus explicit revalidate | PASS |
| RT-04 | Mixed READY and MISSING registry | PASS |
| RT-05 | Ambiguous duplicate filename handling | AUTOMATED COVERAGE ONLY |
| RT-06 | Access-error handling | AUTOMATED COVERAGE ONLY |
| RT-07 | Process Project blocked before checkpoint/document open | PASS |
| RT-08 | Registry order preserved | PASS |
| RT-09 | Persistence failure rollback | AUTOMATED COVERAGE ONLY |
| RT-10 | Recovery compatibility classification | AUTOMATED COVERAGE ONLY |
| RT-11 | Plugin reload and project reopen persistence | PASS |
| RT-12 | Final runtime/document/queue/UI cleanup summary | PASS |

## Detailed scenarios

### RT-01 — Valid registry on project open

**Status: PASS**

1. Create/open a fixture project containing two uniquely registered PSDs in
   `Templates`.
2. Close and reopen the project.

Expected:

- both rows show `READY` with the unique-match reason;
- registration IDs and order are unchanged;
- no PSD document opens during open/preflight;
- no recovery checkpoint is created or modified.

### RT-02 — Missing PSD on reopen

**Status: PASS**

1. Start from a saved fixture with a registered PSD.
2. Remove or rename that PSD outside AlbumAI.
3. Close and reopen the project.

Expected:

- the descriptor shows `MISSING` and actionable restore/remove guidance;
- no arbitrary similarly named file is chosen;
- no PSD document opens during validation;
- `project.json` remains valid and retains descriptor identity/order.

### RT-03 — Restored PSD plus explicit revalidate

**Status: PASS**

1. Starting with RT-02's missing row, restore the PSD into the project's
   `Templates` folder.
2. Select **Revalidate Templates**.

Expected:

- the row changes from `MISSING` to `READY` only after one unique match exists;
- the registry remains in the same order;
- no document opens during revalidation;
- the persisted result survives a subsequent panel/project reload.

### RT-04 — Mixed READY and MISSING registry

**Status: PASS**

1. Open a project with at least one present and one removed registered PSD.
2. Revalidate.

Expected:

- ready and missing rows are independently represented;
- summary identifies the blocking count;
- Process Project is unavailable/blocked;
- no checkpoint, recovery mutation, or PSD opening occurs.

### RT-05 — Ambiguous duplicate filename handling

**Status: AUTOMATED COVERAGE ONLY**

1. Arrange multiple project-owned PSD entries that meet the descriptor's match
   rule without a unique safe resolution.
2. Reopen or revalidate.

Expected:

- descriptor state is `AMBIGUOUS`;
- AlbumAI does not choose a candidate or open either PSD;
- UI explains duplicate-remediation steps without exposing paths/tokens;
- Process Project remains blocked.

### RT-06 — Access-error handling

**Status: AUTOMATED COVERAGE ONLY**

1. Use a controlled fixture/host fault to make a matching PSD or its storage
   inspection unavailable while the entry still exists.
2. Revalidate.

Expected:

- affected descriptor becomes `ACCESS_ERROR` with bounded safe copy;
- unrelated uniquely readable descriptors remain `READY` when possible;
- no PSD document is opened;
- retrying after access returns can restore `READY`.

### RT-07 — Process Project blocked before checkpoint/document open

**Status: PASS**

1. Prepare selected photos and a registry containing any blocking state.
2. Record recovery snapshot/version and open-document state.
3. Invoke Process Project.

Expected:

- Process Project reports template-registry remediation before starting;
- no `beginRecoverySnapshot`/checkpoint write or recovery mutation;
- no template document opens and no placement/replacement/save/export stage
  begins;
- prior recovery snapshot remains byte-for-byte/logically unchanged.

### RT-08 — Registry order preserved

**Status: PASS**

1. Register at least three PSDs and place them in a deliberate non-alphabetic
   order.
2. Reopen, revalidate, make one missing, restore it, and revalidate again.

Expected:

- `registrationOrder`, row order, and recovery registry version remain based on
  descriptor identity/order, not scan order or validation state;
- validation never reorders rows;
- batch queue order remains predictable once all entries are `READY`.

### RT-09 — Persistence failure rollback

**Status: AUTOMATED COVERAGE ONLY**

1. Begin with a saved valid registry and capture metadata/row states.
2. Induce a controlled atomic project-save failure while revalidating or
   registering/removing a template.

Expected:

- disk `project.json` remains valid/recoverable;
- in-memory registry, validation state, metadata, and order return to their
  exact pre-operation values;
- recovery is retained unchanged;
- no PSD document opens due to this flow.

### RT-10 — Recovery compatibility classification

**Status: AUTOMATED COVERAGE ONLY**

1. Create a non-running recoverable batch snapshot for a valid registry.
2. Make one PSD missing and reopen/revalidate.

Expected:

- recovery is retained, not cleared;
- state is separately classified as blocked by template availability;
- resume/retry is unavailable until the registry is again valid or the user
  explicitly chooses a persisted recovery policy;
- no stale recovery mutation occurs merely from validation.

### RT-11 — Plugin reload and project reopen persistence

**Status: PASS**

1. Validate a fixture containing representative READY and blocking results.
2. Save, reload the plugin/project, and reopen.

Expected:

- descriptor IDs, references, order, and coherent validation state restore;
- revalidation produces the same result against unchanged folder contents;
- recovery classification follows the separately documented policy;
- no automatic PSD document opening occurs at startup.

### RT-12 — Final document/queue/runtime safety summary

**Status: PASS**

1. Execute RT-01 through RT-11, including revalidation/reload/failure paths.
2. Close any intentionally opened documents from valid post-preflight batch
   tests, close the project, and capture available runtime diagnostics.

Expected:

- no documents remain owned from basic validation;
- no leaked document references, pending batch work, or stale queue work;
- browser thumbnail runtime invariants remain unaffected by template-only
  validation;
- any intentional post-preflight batch documents are closed by existing batch
  lifecycle handling;
- final result records exact host diagnostic values and deviations.

## Verification record

All results below apply to the final ALB-044 stack through `91796e4`.

| Scenario | Result | Evidence | Notes |
| --- | --- | --- | --- |
| RT-01 | PASS | Project open displayed `Ready: 3 · Blocking: 0`. | Startup preflight caused no project save when observations were unchanged. |
| RT-02 | PASS | Removing one registered PSD and reopening displayed `Ready: 2 · Blocking: 1`. | The missing descriptor remained in registry order and Process Project was disabled. |
| RT-03 | PASS | Restoring the PSD and selecting **Revalidate Templates** returned the row to `READY`. | The meaningful change persisted exactly once; a subsequent unchanged revalidation caused no save. |
| RT-04 | PASS | READY and MISSING rows rendered independently with the expected aggregate counts. | The mixed registry blocked processing. |
| RT-05 | AUTOMATED COVERAGE ONLY | Deterministic duplicate-match tests verify `AMBIGUOUS`, no guessed candidate, and no document API call. | Manual reproduction is blocked by same-folder filename uniqueness in the tested UXP storage workflow. |
| RT-06 | AUTOMATED COVERAGE ONLY | Deterministic service/controller tests verify entry metadata and folder-enumeration access failures. | Folder-level `getEntries()` failure conservatively classifies registered descriptors as `ACCESS_ERROR`. |
| RT-07 | PASS | Process Project was disabled for the runtime MISSING registry. Automated gate tests assert no checkpoint, executor, reader, document open, or recovery mutation. | Blocking occurs before batch startup. |
| RT-08 | PASS | Three-template registry order remained stable across open, missing-file detection, restoration, and revalidation. | Validation observations did not alter descriptor identity/order. |
| RT-09 | AUTOMATED COVERAGE ONLY | Save-failure tests verify exact registry and controller-preflight rollback while the project remains open. | Recovery remains unchanged and no Photoshop document API is invoked. |
| RT-10 | AUTOMATED COVERAGE ONLY | Compatibility tests cover `COMPATIBLE`, `BLOCKED_TEMPLATE_REGISTRY`, and identity/order-driven `STALE_REGISTRY`. | Validation never silently clears recovery. |
| RT-11 | PASS | Plugin reload and project reopen restored persisted descriptor identity, order, and coherent observations, followed by current-session revalidation. | Unchanged open validation caused no project save. |
| RT-12 | PASS | Close cleanup reported zero browser/preview decodes, pending jobs, and browser-owned Photoshop document opens. | The stale-row defect found during runtime testing was fixed in `91796e4` and retested PASS. |

## Verified runtime behavior

- A valid three-template registry displayed `Ready: 3 · Blocking: 0`.
- Removing one registered PSD and reopening displayed `Ready: 2 · Blocking: 1`.
- Process Project was disabled while the registry was blocked.
- Restoring the PSD and explicitly revalidating returned the template to
  `READY`.
- Meaningful validation changes persisted exactly once.
- Unchanged project-open validation caused no project save.
- Unchanged explicit revalidation caused no project save.
- Registry identity and order were preserved.
- Closing the project cleared registered rows, registered count, preflight
  summary, transient messages, and revalidation busy state.
- Closing the project left these runtime counters at zero:
  - `activeBrowserDecodes: 0`
  - `activePreviewDecodes: 0`
  - `pendingJobs: 0`
  - `photoshopDocumentsOpenedByBrowser: 0`
- No Maximum update depth warning was observed.
- Startup and explicit-revalidation preflight opened no PSD documents.
- No silent recovery clearing was observed.
- Manual `AMBIGUOUS` reproduction was blocked by same-folder filename
  uniqueness; deterministic automated coverage verifies the state and gate.
- `ACCESS_ERROR`, persistence-failure rollback, and recovery compatibility
  remain deterministic automated coverage.
- One invalid/corrupted `project.json` was observed during testing. It is
  recorded as a separate test-data/project-file issue, not an ALB-044
  regression.
- Stale registry rows after close were found during runtime testing, fixed by
  `91796e4`, and runtime retested PASS.

## Automated verification

- `npm test -- --runInBand`: **PASS — 70 tests**
- `npm run build`: **PASS**
- `git diff --check`: **PASS** for tracked source and documentation after
  generated `dist/index.js` restoration
- Working tree before this documentation update: **clean**

## Commit stack

1. `91796e4 fix(alb-044): clear template registry UI on project close`
2. `753d3ff feat(alb-044): add template preflight remediation UI`
3. `f126d37 feat(alb-044): gate project execution on template preflight`
4. `780076f feat(alb-044): persist changed template preflight observations`
5. `25ef227 feat(alb-044): add template registry preflight state model`
6. `916eaa9 docs(alb-044): add template registry preflight and recovery plan`

## Final sign-off

- Basic validation opens no PSD documents: **PASS**
- Blocking registry states prevent pre-checkpoint processing: **PASS**
- Persistence rollback: **AUTOMATED COVERAGE COMPLETE**
- Recovery is retained/classified without silent clearing: **AUTOMATED COVERAGE COMPLETE**
- Plugin reload and project reopen persistence: **PASS**
- Browser/document/queue/UI close safety: **PASS**
- ALB-044 implementation and runtime validation: **COMPLETE**

## Remaining actions

1. Review the documentation diff.
2. Commit the documentation.
3. Push the feature branch.
4. Open a pull request.
5. Merge after final review.

Recorded from final maintainer-supplied runtime evidence on 2026-08-06.
Photoshop/UXP versions:
Commit tested:
Blocking observations:
