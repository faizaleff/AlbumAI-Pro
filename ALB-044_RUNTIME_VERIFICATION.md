# ALB-044 Runtime Verification — Template Registry Preflight and Missing-PSD Recovery

Status: **PENDING — plan-only document; no runtime execution has occurred**
Branch: `feature/alb-044-template-registry-preflight`
Base: `main` at `15b1c41`

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
| RT-01 | Valid registry on project open | PENDING |
| RT-02 | Missing PSD on reopen | PENDING |
| RT-03 | Restored PSD plus explicit revalidate | PENDING |
| RT-04 | Mixed READY and MISSING registry | PENDING |
| RT-05 | Ambiguous duplicate filename handling | PENDING |
| RT-06 | Access-error handling | PENDING |
| RT-07 | Process Project blocked before checkpoint/document open | PENDING |
| RT-08 | Registry order preserved | PENDING |
| RT-09 | Persistence failure rollback | PENDING |
| RT-10 | Recovery compatibility retained without silent clear | PENDING |
| RT-11 | Project reload persistence | PENDING |
| RT-12 | Final document/queue/runtime safety summary | PENDING |

## Detailed scenarios

### RT-01 — Valid registry on project open

**Status: PENDING**

1. Create/open a fixture project containing two uniquely registered PSDs in
   `Templates`.
2. Close and reopen the project.

Expected:

- both rows show `READY` with the unique-match reason;
- registration IDs and order are unchanged;
- no PSD document opens during open/preflight;
- no recovery checkpoint is created or modified.

### RT-02 — Missing PSD on reopen

**Status: PENDING**

1. Start from a saved fixture with a registered PSD.
2. Remove or rename that PSD outside AlbumAI.
3. Close and reopen the project.

Expected:

- the descriptor shows `MISSING` and actionable restore/remove guidance;
- no arbitrary similarly named file is chosen;
- no PSD document opens during validation;
- `project.json` remains valid and retains descriptor identity/order.

### RT-03 — Restored PSD plus explicit revalidate

**Status: PENDING**

1. Starting with RT-02's missing row, restore the PSD into the project's
   `Templates` folder.
2. Select **Revalidate Templates**.

Expected:

- the row changes from `MISSING` to `READY` only after one unique match exists;
- the registry remains in the same order;
- no document opens during revalidation;
- the persisted result survives a subsequent panel/project reload.

### RT-04 — Mixed READY and MISSING registry

**Status: PENDING**

1. Open a project with at least one present and one removed registered PSD.
2. Revalidate.

Expected:

- ready and missing rows are independently represented;
- summary identifies the blocking count;
- Process Project is unavailable/blocked;
- no checkpoint, recovery mutation, or PSD opening occurs.

### RT-05 — Ambiguous duplicate filename handling

**Status: PENDING**

1. Arrange multiple project-owned PSD entries that meet the descriptor's match
   rule without a unique safe resolution.
2. Reopen or revalidate.

Expected:

- descriptor state is `AMBIGUOUS`;
- AlbumAI does not choose a candidate or open either PSD;
- UI explains duplicate-remediation steps without exposing paths/tokens;
- Process Project remains blocked.

### RT-06 — Access-error handling

**Status: PENDING**

1. Use a controlled fixture/host fault to make a matching PSD or its storage
   inspection unavailable while the entry still exists.
2. Revalidate.

Expected:

- affected descriptor becomes `ACCESS_ERROR` with bounded safe copy;
- unrelated uniquely readable descriptors remain `READY` when possible;
- no PSD document is opened;
- retrying after access returns can restore `READY`.

### RT-07 — Process Project blocked before checkpoint/document open

**Status: PENDING**

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

**Status: PENDING**

1. Register at least three PSDs and place them in a deliberate non-alphabetic
   order.
2. Reopen, revalidate, make one missing, restore it, and revalidate again.

Expected:

- `registrationOrder`, row order, and recovery registry version remain based on
  descriptor identity/order, not scan order or validation state;
- validation never reorders rows;
- batch queue order remains predictable once all entries are `READY`.

### RT-09 — Persistence failure rollback

**Status: PENDING**

1. Begin with a saved valid registry and capture metadata/row states.
2. Induce a controlled atomic project-save failure while revalidating or
   registering/removing a template.

Expected:

- disk `project.json` remains valid/recoverable;
- in-memory registry, validation state, metadata, and order return to their
  exact pre-operation values;
- recovery is retained unchanged;
- no PSD document opens due to this flow.

### RT-10 — Recovery compatibility retained without silent clear

**Status: PENDING**

1. Create a non-running recoverable batch snapshot for a valid registry.
2. Make one PSD missing and reopen/revalidate.

Expected:

- recovery is retained, not cleared;
- state is separately classified as blocked by template availability;
- resume/retry is unavailable until the registry is again valid or the user
  explicitly chooses a persisted recovery policy;
- no stale recovery mutation occurs merely from validation.

### RT-11 — Project reload persistence

**Status: PENDING**

1. Validate a fixture containing representative READY and blocking results.
2. Save, reload the plugin/project, and reopen.

Expected:

- descriptor IDs, references, order, and coherent validation state restore;
- revalidation produces the same result against unchanged folder contents;
- recovery classification follows the separately documented policy;
- no automatic PSD document opening occurs at startup.

### RT-12 — Final document/queue/runtime safety summary

**Status: PENDING**

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

Fill only during an implementation/runtime pass.

| Scenario | Result | Commit/build | Evidence | Notes |
| --- | --- | --- | --- | --- |
| RT-01 | PENDING | — | — | — |
| RT-02 | PENDING | — | — | — |
| RT-03 | PENDING | — | — | — |
| RT-04 | PENDING | — | — | — |
| RT-05 | PENDING | — | — | — |
| RT-06 | PENDING | — | — | — |
| RT-07 | PENDING | — | — | — |
| RT-08 | PENDING | — | — | — |
| RT-09 | PENDING | — | — | — |
| RT-10 | PENDING | — | — | — |
| RT-11 | PENDING | — | — | — |
| RT-12 | PENDING | — | — | — |

## Final sign-off

- Basic validation opens no PSD documents: **PENDING**
- Blocking registry states prevent pre-checkpoint processing: **PENDING**
- Persistence rollback is verified: **PENDING**
- Recovery is retained/classified without silent clearing: **PENDING**
- Project reload persistence is verified: **PENDING**
- Browser/document/queue safety is verified: **PENDING**
- Ready to merge: **PENDING**

Tester:
Date:
Photoshop/UXP versions:
Commit tested:
Blocking observations:
