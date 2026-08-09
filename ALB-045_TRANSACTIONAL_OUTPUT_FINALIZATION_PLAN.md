# ALB-045 — Transactional Output Finalization and Cancellation-Safe Save/Export

Branch: `feature/alb-045-transactional-output-finalization`
Base: `main` at `cb52f0b`

## Status and scope

This is a planning and host-capability-characterization slice only. It does not
change production output behavior, run Photoshop, or perform destructive output
tests. Implementation begins only after the capability matrix and focused pure
policy tests described here are accepted.

## Problem

`TemplateAutoSaveService` and `TemplateExportService` currently create the
final output entry with `overwrite: true` before Photoshop has completed the
write. A cancellation requested while Photoshop is saving or exporting is
deliberately deferred, but batch/recovery output data cannot distinguish a
committed output from a cleaned, partial, or unknown artifact.

ALB-045 makes Save Copy and Export transactional at the AlbumAI filesystem
boundary. It does not promise transactional rollback for `OVERWRITE_ORIGINAL`.

## Repository evidence

### Current direct-write behavior

- `TemplateAutoSaveService.copyDestination()` creates
  `Output/Processed/<base>.psd` with `overwrite: true`, then calls
  `DocumentManager.save(document, destination)`.
- `TemplateExportService.destination()` creates `Output/Export/<base>.<ext>`
  with `overwrite: true`, then calls `DocumentManager.save()` for PSD or
  `DocumentManager.exportJPEG()` for JPEG.
- Both services catch errors and return generic `FAILED` results. Neither
  service records staging, verification, cleanup, promotion, or prior-output
  preservation facts.
- `ProjectExecutor` checks cancellation only before replacement, after
  replacement, after Auto Save, and after export. It cannot interrupt a host
  call; cancellation after a write can therefore return a cancelled template
  outcome despite a final-named file having been written.
- `AppController.requestBatchCancellation()` labels cancellation as deferred
  in `REPLACING`, `SAVING`, `EXPORTING`, and `CLOSING`. `BatchExecutionService`
  then records `CANCELLED` at the first safe template boundary.
- Recovery stores autosave/export result objects in template outcomes, but
  these objects currently contain only coarse status, output path, warnings,
  and error fields.

### Existing useful precedent

`AtomicJsonFileWriter` implements a verified JSON temp/backup/rename/rollback
workflow. It proves that this repository uses `entry.delete()`,
`folder.renameEntry(source, name, { overwrite: true })`, and
`entry.moveTo(folder, { newName, overwrite: true })`, with fresh entry lookup
and read-back verification. It explicitly throws when rename support is
unavailable. That implementation is not proof that rename/replace is atomic,
safe for binary Photoshop outputs, or safe to blindly reuse.

### Current test boundary

The Node harness has ALB-043 and ALB-044 tests only. It has no focused Auto
Save/export, output-transaction, host-write failure, output preservation, or
cancellation-during-write coverage. The existing UXP mock exposes only an
empty filesystem; ALB-045 needs a purpose-built in-memory output filesystem
double that can inject every capability/failure boundary.

## Locked guarantees and invariants

1. Save Copy and Export never write directly to a final output name.
2. Success requires staging creation, host completion, staging verification,
   and safe finalization.
3. Cancellation never interrupts a Photoshop save/export modal call.
4. A cancellation during host write becomes effective only after the output
   transaction reaches a deterministic terminal state.
5. A committed output remains committed if the enclosing batch becomes
   `CANCELLED` afterward.
6. Validation, cleanup, promotion, and recovery never guess an unknown
   artifact is valid.
7. Prior valid output is never blindly replaced before staging is verified.
8. `OVERWRITE_ORIGINAL` is non-reversible and has a separate contract.
9. Public results, recovery JSON, UI, and diagnostics contain no native paths,
   tokens, filesystem entries, or Photoshop host objects.

## State model

### Output transaction state

| State | Meaning | Terminal |
| --- | --- | --- |
| `NOT_STARTED` | No output side effect started. | Yes when cancelled before write. |
| `STAGING_CREATED` | Unique same-folder staging entry exists. | No |
| `HOST_WRITE_IN_PROGRESS` | Photoshop owns the active write. | No |
| `STAGED` | Host call returned successfully. | No |
| `VERIFIED` | Minimum format-specific staging checks passed. | No |
| `COMMITTED` | Final output promotion and final verification succeeded. | Yes |
| `CLEANED` | Uncommitted staging artifact was removed. | Yes |
| `CLEANUP_FAILED` | Artifact could not be safely removed. | Yes; remediation required. |
| `COMMIT_UNKNOWN` | Promotion/preservation/final verification cannot establish a safe truth. | Yes; automatic retry blocked. |

### Cancellation state

| State | Meaning |
| --- | --- |
| `NONE` | No cancellation was observed. |
| `REQUESTED_BEFORE_WRITE` | Request reached a safe pre-host boundary. |
| `REQUESTED_DURING_WRITE` | Request arrived while Photoshop owns the write. |
| `EFFECTIVE_AFTER_CLEANUP` | Request became effective after a deterministic uncommitted cleanup result. |
| `EFFECTIVE_AFTER_COMMIT` | Request became effective after a verified final commit. |

### Reason-code categories

`STAGING_CREATE_FAILED`, `HOST_WRITE_FAILED`, `STAGING_MISSING`,
`STAGING_EMPTY`, `STAGING_READ_FAILED`, `PROMOTION_FAILED`,
`EXISTING_OUTPUT_PRESERVE_FAILED`, `CLEANUP_FAILED`,
`COMMIT_VERIFICATION_FAILED`, `OVERWRITE_ORIGINAL_COMMITTED`,
`CANCELLED_BEFORE_WRITE`, and `CANCELLED_AFTER_COMMIT` are the required
public-safe categories. A reason code explains a state; it never contains a
host exception string, path, token, or entry object.

## Filesystem capability findings

| Capability | Repository evidence | Characterization status | ALB-045 policy |
| --- | --- | --- | --- |
| Create file | `createFile(name, { overwrite })` is used for final outputs and JSON temps. | Available; output behavior with existing entry needs a mock/runtime check. | Create unique staging with `overwrite: false`. |
| Delete | `entry.delete()` is used by JSON writer. | Available when supplied by host entry; not guaranteed by current test mock. | Required for cleanup; failure yields `CLEANUP_FAILED`. |
| Rename | `folder.renameEntry()` is used by JSON writer. | Optional host capability; atomicity unproven. | Capability adapter probes support; never assumes atomic replacement. |
| Move | `entry.moveTo()` is a JSON writer fallback. | Optional host capability; atomicity unproven. | Same as rename. |
| Replace/overwrite | JSON writer passes `overwrite: true` to rename/move. Output services pass it to `createFile`. | Present in calls, not semantically characterized. | Never use as evidence of atomic promotion. |
| Metadata/size | Photo code reads `entry.size`; output code does not. | May be available; needs host/mocked check. | Use positive finite size when available, but do not rely on it alone. |
| Readability | `entry.read()` is used for JSON and image capability work. | Available in repository patterns; binary result behavior must be characterized. | Required minimum check where safe; read failure is `STAGING_READ_FAILED`. |
| Preserve prior final | JSON writer has backup rotation. | No binary-output implementation. | Preserve prior final before a non-atomic promotion; otherwise fail closed. |
| Same-folder promotion | Rename/move API calls target same folder. | No atomicity or replacement guarantee established. | Use Strategy B unless an explicit capability test proves a stronger contract. |

No repository evidence proves Strategy A. The capability adapter and runtime
matrix must record exact UXP/Photoshop versions and observed behavior before
declaring any operation atomic.

Closeout note: the disposable-folder host characterization is now recorded as
PASS/CLOSED in `ALB-045_RUNTIME_VERIFICATION.md`. Rename and move were available,
but safe atomic replacement was not proven; `canReplaceExistingProven` remains
false and existing-final output continues to use `PRESERVE_THEN_PROMOTE`.

## Finalization strategies

### Strategy A — atomic rename/replace

Allowed only if a host capability test proves same-folder rename/replace is
atomic and preserves a valid prior final on failure. This is not the initial
implementation assumption and requires no fallback inference from API shape.

### Strategy B — explicit backup, promotion, verification, rollback

Default candidate where required APIs are available:

1. Create and write unique staging in the final output folder.
2. Verify staging.
3. If final exists, move it to a unique same-folder backup and verify the
   backup is readable.
4. Promote staging to final without assuming overwrite is atomic.
5. Re-resolve and verify the final output.
6. Delete the verified backup only after final verification.
7. On promotion/final verification failure, attempt restore of the verified
   backup. If restoration cannot be verified, report `COMMIT_UNKNOWN`.

Backup cleanup failure after verified final commit keeps `COMMITTED` with a
safe cleanup warning and a retained recovery remediation fact; it must not
claim that cleanup succeeded.

### Strategy C — fail closed

If safe promotion, prior-final preservation, or recovery cannot be guaranteed,
do not write a final name. Retain a clearly named staging artifact only when it
can be safely identified; otherwise classify `COMMIT_UNKNOWN`. Automatic retry
is blocked for `COMMIT_UNKNOWN` and `CLEANUP_FAILED`.

## Verification policy

Verification is intentionally filesystem-level; reopening Photoshop documents
is out of scope unless runtime characterization proves it is indispensable.

| Output | Minimum required checks | Optional strengthening |
| --- | --- | --- |
| Save Copy PSD | Staging re-resolves, is a file, has positive size when available, and can be read. | PSD `8BPS` header signature from bounded binary read. |
| PSD Export | Same as Save Copy PSD. | Same bounded `8BPS` check. |
| JPEG Export | Staging re-resolves, is a file, has positive size when available, and can be read. | JPEG SOI `FF D8` and EOI `FF D9` checks using bounded/header-tail reads where supported. |

The implementation must characterize `File.read()` result types and memory
cost before reading large PSD/JPEG files. If bounded reads are unavailable,
readability plus non-zero size is the minimum; absence of a reliable check
must fail closed rather than claim a fully verified artifact.

## Cancellation boundaries

| Boundary | Required behavior |
| --- | --- |
| Before staging | Mark `REQUESTED_BEFORE_WRITE`; no entry is created; result is safe to retry. |
| After staging, before host call | Do not call Photoshop; delete staging. Cleanup success is `CLEANED` + `EFFECTIVE_AFTER_CLEANUP`; failure is `CLEANUP_FAILED`. |
| During host write | Mark `REQUESTED_DURING_WRITE`; await host completion without attempting interruption. |
| After host write, before verification | Verify then clean/finalize deterministically; never infer success from host return alone. |
| After verification, before promotion | Either promote under the selected strategy or clean staging; cancellation remains deferred through terminal outcome. |
| After promotion | Verify final, mark `COMMITTED`, then make cancellation effective as `EFFECTIVE_AFTER_COMMIT`. |
| During cleanup | Await cleanup. Success is `CLEANED`; failure is `CLEANUP_FAILED`, which blocks automatic retry. |

## Existing-final-output preservation policy

- A final output is never blindly overwritten before verified staging exists.
- Strategy B uses an adjacent, unique backup with an opaque transaction id;
  public results expose only the safe final display name and state.
- A previous final is deleted only after the new final has been re-resolved and
  verified.
- If preservation fails, do not promote staging; clean it if possible and
  report `EXISTING_OUTPUT_PRESERVE_FAILED`.
- If a failed promotion or rollback leaves filesystem truth indeterminate,
  report `COMMIT_UNKNOWN`; retain artifacts for explicit remediation and do
  not auto-retry.

## Recovery and retry policy

| Transaction outcome | Recovery representation | Default retry behavior |
| --- | --- | --- |
| `NOT_STARTED` | No committed output | Retry |
| `CLEANED` or failed uncommitted | Safe failed/cancelled outcome | Retry |
| `COMMITTED` | Durable output fact | Skip by default |
| `EFFECTIVE_AFTER_COMMIT` | Committed, then cancelled | Skip by default |
| `CLEANUP_FAILED` | Explicit remediation required | Block automatic retry |
| `COMMIT_UNKNOWN` | Reconciliation required | Block automatic retry |

Per-template outcomes need a detached `outputTransaction` snapshot for Auto
Save and export. `BatchRecoverySnapshot`, completion summary, retry selection,
and debug diagnostics must consume that snapshot rather than infer commitment
from template/batch status alone.

## OVERWRITE_ORIGINAL contract

`OVERWRITE_ORIGINAL` does not stage or roll back the original PSD. Once the
Photoshop host save returns successfully, the result is committed with
`OVERWRITE_ORIGINAL_COMMITTED`; a later cancellation is
`EFFECTIVE_AFTER_COMMIT` and reports committed-before-cancellation. The UI
should show a concise non-reversible warning before enabling this mode for a
cancellable project batch. Whether this requires a one-time explicit
acknowledgement is an implementation decision to validate with product owner
before Slice 6; no acknowledgement mechanism is added in this plan slice.

## Service, controller, and UI boundaries

- `OutputTransactionService` (new): filesystem capability adapter, staging,
  verification, preservation/promotion/rollback policy, and safe snapshot.
- `TemplateAutoSaveService`: selects Save Copy versus non-reversible overwrite
  contract; delegates Save Copy finalization to the transaction service.
- `TemplateExportService`: delegates PSD/JPEG finalization to the transaction
  service.
- `DocumentManager`: remains the Photoshop modal writer only; it does not own
  cleanup, promotion, retry, or recovery policy.
- `ProjectExecutor`: observes cancellation at transaction boundaries and
  returns result objects that preserve committed facts.
- `BatchExecutionService`: preserves committed/cancelled template output facts
  rather than treating all cancelled templates as uncommitted pending work.
- `AppController` and `BatchRecoverySnapshot`: serialize detached safe outcome
  snapshots and select retry/resume work from policy, not output filename.
- `BatchProgressPanel`/completion UI: show compact committed, cleanup-needed,
  or reconciliation-needed status without paths/tokens.

## API proposal

Names are proposals to validate against UXP constraints during implementation.

```js
// OutputTransactionService
async characterize(folder) // capability facts; no mutation in production path
async begin({ folder, finalName, kind })
// => transaction with safe snapshot() and host destination entry
async verifyStaging(transaction, { format })
async finalize(transaction, { cancellationRequested })
async cleanup(transaction, { reason })

// Safe serialized result fragment
{
  transactionState: "COMMITTED",
  cancellationState: "EFFECTIVE_AFTER_COMMIT",
  reasonCode: "CANCELLED_AFTER_COMMIT",
  outputName: "template.jpg",
  retryDisposition: "SKIP_DEFAULT"
}
```

The adapter may report capability unavailable; it must not perform a destructive
probe against a user output folder. Capability tests use isolated fixtures.

## Test architecture

Add focused Node scripts in the current no-framework harness style.

1. Pure state-machine/policy tests: allowed transitions, cancellation timing,
   retry dispositions, safe serialization, and no path/token leakage.
2. In-memory output filesystem double: create/read/size/delete/rename/move,
   existing-final preservation, and injected failure at every boundary.
3. Transaction tests: Save Copy PSD, PSD export, JPEG export, success,
   host-write failure, promotion failure, backup/rollback failure, cleanup
   failure, and commit-unknown classification.
4. Orchestration tests: cancellation before/during/after host write, recovery
   serialization, retry skip/block decisions, and batch totals.
5. Regressions: `npm test`, production build, `git diff --check`; do not
   modify generated `dist/index.js`.

## Runtime matrix

See `ALB-045_RUNTIME_VERIFICATION.md`. RT-14 is PASS/CLOSED from recorded
Photoshop evidence; RT-01–RT-13 and RT-15 remain pending and must use isolated
disposable fixtures. Destructive output tests are prohibited until the strategy
and fixture protocol are approved.

## Implementation slices

1. State/result model and pure transaction-policy tests.
2. Filesystem capability adapter plus staging/verification helpers.
3. Save Copy integration.
4. PSD/JPEG export integration.
5. Cancellation, recovery, and retry propagation.
6. UI summary, diagnostics, runtime closeout.

## Risks

- UXP rename/move replacement may not be atomic or may have undocumented
  destination semantics.
- Photoshop may create bytes even when its save/export API rejects; verification
  must not overstate success.
- Large output read-back can be expensive; verification must be bounded.
- `OVERWRITE_ORIGINAL` cannot meet copy/export rollback guarantees.
- Failed cleanup or rollback can leave user-visible artifacts; safe
  classification and explicit remediation are more important than silent
  deletion.

## Non-goals

- Interrupting Photoshop mid-save/export.
- Broad batch/recovery refactoring.
- New export formats, output browsing, cloud features, or template validation.
- Automatic destructive capability probes in user project folders.
- Transactional rollback for `OVERWRITE_ORIGINAL`.

## Acceptance criteria

- The locked guarantees and state/reason models are implemented and covered by
  deterministic tests.
- Save Copy and export final names are reached only through verified staging
  and a safe finalization strategy.
- Existing valid outputs survive every injected pre-commit failure.
- `COMMIT_UNKNOWN` and `CLEANUP_FAILED` block automatic retry.
- A committed output remains represented as committed after batch cancellation.
- Runtime scenarios pass on a recorded Photoshop/UXP version before merge.
- No public-safe output result, recovery snapshot, UI state, or diagnostic
  exposes a path, token, entry, or host object.

## Commit strategy

1. `docs(alb-045): add transactional output finalization plan and runtime matrix`
2. `test(alb-045): characterize output transaction policy and filesystem capabilities`
3. `feat(alb-045): add output staging and verification adapter`
4. `feat(alb-045): finalize save-copy and export outputs transactionally`
5. `feat(alb-045): preserve committed output facts through cancellation recovery`
6. `feat(alb-045): add output transaction summary and diagnostics`
7. `docs(alb-045): record runtime verification`
