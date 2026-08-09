# ALB-045 Runtime Verification — Transactional Output Finalization and Cancellation-Safe Save/Export

Status: **PARTIAL — Photoshop runtime PASS where exercised; deterministic fault-injection coverage PASS; remaining runtime evidence called out below**
Branch: `feature/alb-045-transactional-output-finalization`
Base: `main` at `cb52f0b`

## Slice 3 implementation note

Save Copy PSD is now wired to the ALB-045 staging transaction helper in source:
Photoshop writes only to a same-folder staging entry; an existing final is
preserved to an AlbumAI-owned backup before promotion; PSD verification uses a
binary `8BPS` header read; and backup cleanup happens only after final
verification. The locked capability report does not prove safe replacement, so
the runtime path remains backup-first. Bounded binary header reads are not
available in the characterized host and the current PSD verification may read
the full small/normal output file. No Photoshop runtime scenario is marked
PASS by this implementation note.

## Slice 4 implementation note

PSD and JPEG Export now use the same same-folder staging, verification, and
backup-first promotion path as Save Copy PSD. Photoshop receives only the
staging entry for its export operation; the user-visible final name is promoted
only after format-appropriate binary-signature verification. Batch execution
passes its cancellation controller to both Auto Save and Export so a request is
observed at the defined transaction boundaries and deferred while Photoshop
owns the host write. No Photoshop runtime scenario is marked PASS by this
implementation note.

## Slice 5 implementation note

Recovery now persists only detached, normalized output-transaction facts for
Auto Save and Export, rather than result paths or host-derived values. Retry
and resume selection blocks `COMMIT_UNKNOWN` and `CLEANUP_FAILED`, while a
verified output committed before cancellation is complete-by-default and is
not requeued automatically. Existing legacy success claims without a
transaction fact normalize fail-closed to `COMMIT_UNKNOWN`. No Photoshop
runtime scenario is marked PASS by this implementation note.

## Slice 6 implementation note

Completion and recovery surfaces now show explicit `COMMITTED`, safe-retry,
`COMMIT_UNKNOWN`, and remediation-required output counts and per-output
operator messages. Automatic Resume/Retry actions are offered only when the
authoritative recovery policy identifies safe work; ambiguous and cleanup-
required outputs remain visible and blocked. Safe count-only transaction
diagnostics were added, and Overwrite Original is labeled non-reversible. No
Photoshop runtime scenario is marked PASS by this implementation note.

## 2026-08-07 close-out evidence

The following results are recorded from the ALB-045 branch close-out. Statuses
distinguish Photoshop runtime observations from deterministic injected-failure
coverage; a harness result is not relabeled as a Photoshop runtime PASS.

- Normal 3-template Save Copy + JPEG run: 3/3 successful; 6/6 output
  transactions `COMMITTED`.
- Existing-output replacement run: 3/3 successful; 6/6 `COMMITTED`; no
  `COMMIT_UNKNOWN` or cleanup-required state observed.
- Cancellation during Save Copy: batch `CANCELLED`; the committed output was
  preserved and remaining work was classified safely.
- Cancellation during JPEG Export: Auto Save remained `COMMITTED`; Export was
  safe to retry with `CANCELLED_BEFORE_WRITE`.
- Cancelled recovery survived panel reload as `INTERRUPTED/CANCELLED`, last
  stage `EXPORTING`, with automatic retry available for the three pending
  templates.
- Final-cleanup run: 3/3 completed, pending templates 0, recovery unavailable,
  6/6 outputs `COMMITTED`, and no warning or fatal error.
- Deterministic transaction suites PASS host-write, verification, promotion,
  rollback, cleanup-failure, commit-unknown, cancellation-boundary, recovery,
  retry-blocking, and operator-state cases.
- Intentional Photoshop forced-failure scenarios were not manufactured where
  no safe deterministic runtime trigger exists. RT-06 is explicitly classified
  `HARNESS PASS / PHOTOSHOP FORCED-FAILURE RUNTIME NOT RUN`.
- No retained Photoshop log proves RT-03 (cancellation before output
  transaction). Its harness contract passes, but Photoshop runtime evidence
  must not be inferred. RT-14 has separate accepted Photoshop runtime evidence
  recorded below and is `PASS / CLOSED`.

## Purpose

This matrix verifies that Save Copy and Export reach a final output name only
after staging, host completion, verification, and safe finalization. It also
verifies that cancellation is deferred while Photoshop owns a save/export call,
then records an unambiguous committed or uncommitted result.

Do not run destructive output tests against user projects. Use isolated,
disposable fixtures with copied PSDs and disposable Output folders. Record the
Photoshop version, UXP version, plugin commit, fixture name, selected strategy
(A/B/C), capability adapter result, and before/after safe file inventory for
each scenario.

## Required runtime observations

- No Photoshop save/export call receives an in-flight cancellation interrupt.
- Final outputs have no staging suffix and staging/backup artifacts are absent
  after normal success.
- A prior final output is not lost after any failed pre-commit operation.
- No result/log/recovery UI exposes native paths, tokens, entries, or host
  objects.
- Final document/queue diagnostics are captured after each terminal scenario.

## RT-14 runtime evidence — PASS/CLOSED

Maintainer-supplied Photoshop runtime evidence accepted on 2026-08-07:

- Process Project ended with last stage `SAVING` after the real Photoshop
  overwrite host call returned successfully.
- Auto Save result was `SAVED`; the copied fixture output was
  `TES PSD 04.psd`.
- Recovery recorded `OVERWRITE_ORIGINAL_COMMITTED`.
- Output recovery totals were one committed, two safe to retry, zero
  `COMMIT_UNKNOWN`, and zero cleanup-required.
- Two templates remained. The panel recovery summary matched the authoritative
  Debug Log.
- The explicitly armed RT-14 synchronization gate finished with `armed: false`,
  `waiting: false`, and `lastOutcome: CANCELLATION_OBSERVED`.
- The overwritten copied PSD reopened successfully with the processed photos;
  no corruption or opening error was observed.
- The committed template's allocation was consumed as
  `COMMITTED_AFTER_CANCEL`; the two unopened templates retained the remaining
  photo cursor.

The gate was audited after evidence capture. It was inert unless manually
armed, waited only after the real host save returned, never created transaction
results, and its error path could not downgrade a committed overwrite. The
globally armable runtime surface and production wiring were removed for final
closeout. A constructor-injected test seam remains unconfigured in production
to preserve deterministic automated coverage of the post-commit contract.

## Scenario matrix

| ID | Scenario | Expected contract | Status |
| --- | --- | --- | --- |
| RT-01 | Save Copy PSD success | Verified staging is safely committed; no staging remains. | **PASS — Photoshop runtime + harness** |
| RT-02 | JPEG export success | Verified staging is safely committed; no staging remains. | **PASS — Photoshop runtime + harness** |
| RT-03 | Cancellation before output transaction | No staging/final output is created; retry is available. | **HARNESS PASS — Photoshop runtime evidence not retained** |
| RT-04 | Cancellation during Save Copy | Host write is awaited; final result is either committed or deterministically uncommitted/cleaned. | **PASS — Photoshop runtime + harness** |
| RT-05 | Cancellation during JPEG export | Same deferred-cancellation contract as RT-04. | **PASS — Photoshop runtime + harness** |
| RT-06 | Host write failure with no existing final | No final output; staging is cleaned or explicitly classified. | **HARNESS PASS — Photoshop forced-failure runtime not run (unsafe/non-deterministic trigger)** |
| RT-07 | Host write failure with existing final preserved | Existing final remains readable and unchanged. | **HARNESS PASS — injected filesystem failure; Photoshop forced-failure runtime not run** |
| RT-08 | Successful replacement of existing final | Prior output is preserved until new final verification; cleanup follows policy. | **PASS — Photoshop runtime + harness** |
| RT-09 | Promotion failure and rollback/preservation | Prior final is restored/verified, or result is `COMMIT_UNKNOWN`; never claim success. | **HARNESS PASS — injected promotion/rollback failures; Photoshop forced-failure runtime not run** |
| RT-10 | Cleanup failure classification | Result is `CLEANUP_FAILED`; automatic retry is unavailable. | **HARNESS PASS — injected cleanup failure; Photoshop forced-failure runtime not run** |
| RT-11 | Committed output followed by batch cancellation | Output remains `COMMITTED`; cancellation state is effective-after-commit; retry skips by default. | **PASS — Photoshop runtime + harness** |
| RT-12 | Close/reload recovery outcome consistency | Persisted recovery and UI agree with transaction outcome and retry disposition. | **PASS — Photoshop runtime** |
| RT-13 | `COMMIT_UNKNOWN` remediation behavior | Resume/retry is blocked until explicit reconciliation; no validity guess. | **HARNESS PASS — injected ambiguity + UI/recovery policy; Photoshop forced-failure runtime not run** |
| RT-14 | `OVERWRITE_ORIGINAL` cancellation contract | Successful host save remains committed and non-reversible; wording is explicit. | **PASS / CLOSED — Photoshop runtime + harness** |
| RT-15 | Final document/queue/staging cleanup summary | No AlbumAI document/queue leak; staging/backup inventory matches terminal state. | **PASS — Photoshop runtime** |

## Checklist reconciliation

Automated coverage establishes policy and orchestration behavior but is not
substituted for Photoshop runtime evidence.

| Scenario | Automated coverage | Recorded Photoshop runtime evidence | Final status |
| --- | --- | --- | --- |
| RT-01 | Save Copy staging, PSD verification, promotion, and committed result. | Normal 3-template run completed 3/3 with committed Save Copy outputs. | **PASS — Photoshop runtime + harness** |
| RT-02 | JPEG staging, signature verification, promotion, and committed result. | Normal 3-template run completed 3/3 with committed JPEG outputs. | **PASS — Photoshop runtime + harness** |
| RT-03 | Cancellation before staging/write; no host call; retry disposition. | No retained Photoshop runtime evidence. | **HARNESS PASS — Photoshop runtime evidence not retained** |
| RT-04 | Cancellation boundaries around Save Copy host write and commit. | Cancellation during Save Copy preserved the committed output and classified remaining work safely. | **PASS — Photoshop runtime + harness** |
| RT-05 | Cancellation boundaries around JPEG export and commit. | Cancellation during JPEG Export left Auto Save committed and Export safe to retry with `CANCELLED_BEFORE_WRITE`. | **PASS — Photoshop runtime + harness** |
| RT-06 | Host-write failure with staging cleanup and no final commit. | No safe deterministic Photoshop forced-failure trigger was run. | **HARNESS PASS — Photoshop forced-failure runtime not run** |
| RT-07 | Existing-final preservation on pre-commit failure. | Covered by deterministic injected filesystem failure; no Photoshop forced-failure run. | **HARNESS PASS — injected failure only** |
| RT-08 | Backup-first replacement, final verification, and backup cleanup. | Existing-output replacement completed 3/3 with 6/6 committed and no ambiguous or cleanup-required state. | **PASS — Photoshop runtime + harness** |
| RT-09 | Promotion failure, verified rollback, and `COMMIT_UNKNOWN` fallback. | Covered by deterministic injected promotion and rollback failures only. | **HARNESS PASS — injected failure only** |
| RT-10 | Cleanup failure produces remediation-required and blocks retry. | Covered by deterministic injected cleanup failure only. | **HARNESS PASS — injected failure only** |
| RT-11 | Committed cancellation accounting, skip-default, and photo cursor handling. | Save Copy cancellation preserved committed output; RT-14 additionally verified `COMMITTED_AFTER_CANCEL` allocation handling. | **PASS — Photoshop runtime + harness** |
| RT-12 | Detached recovery serialization, reload normalization, UI/retry consistency. | Cancelled recovery survived panel reload with consistent interrupted/cancelled state and retry availability. | **PASS — Photoshop runtime** |
| RT-13 | `COMMIT_UNKNOWN` blocks automatic retry and is explicit in UI. | Covered by deterministic injected ambiguity and UI/recovery policy only. | **HARNESS PASS — injected ambiguity only** |
| RT-14 | Direct overwrite commit, post-commit cancellation, recovery accounting, and UI totals. | Full Photoshop runtime evidence is recorded above. | **PASS / CLOSED — Photoshop runtime + harness** |
| RT-15 | Deterministic cleanup/summary policy and output-state totals. | Final cleanup run completed 3/3 with zero pending templates, 6/6 committed outputs, no recovery, warning, or fatal error. | **PASS — Photoshop runtime** |

### Documentation-only follow-up

- Add the Photoshop and UXP version numbers to the RT-14 evidence record if
  they are available from the completed run. The accepted test must not be
  repeated solely to recover this metadata.
- Mark additional scenario rows PASS only when their distinct runtime evidence
  is recorded. The automated suite already covers their deterministic policy
  contracts.

## Host capability characterization

Status: **PASS / CLOSED**

Maintainer-supplied Photoshop/UXP host evidence accepted on 2026-08-07. The
diagnostic ran only in a newly created disposable external parent folder.
Finder verification after completion showed that the parent was empty, no
generated capability child or test artifact remained, and no user file was
touched.

Captured safe report:

```text
canRenameSameFolder: true
canMoveSameFolder: true
renameDestinationExistsBehavior: REPLACED
moveDestinationExistsBehavior: REPLACED
staleHandleAfterRename: DIFFERENT_OBJECT
staleHandleAfterMove: DIFFERENT_OBJECT
staleHandleAfterDelete: UNREADABLE
canInspectSize: false
sizeRefreshReliable: false
canReadBinary: true
binaryReadType: ARRAY_BUFFER
boundedHeaderReadSupported: false
psdSignatureReadable: true
jpegSoiReadable: true
canReplaceExistingProven: false
cleanupSucceeded: true
cleanupFailed: false
recommendedPromotionStrategy: PRESERVE_THEN_PROMOTE
```

`canInspectSize: false`, `sizeRefreshReliable: false`, and
`boundedHeaderReadSupported: false` are characterized host limitations, not
test failures. Binary signature reads remain available through `ARRAY_BUFFER`.
The observed rename/move collision replacement does not prove atomic or safe
direct replacement. `canReplaceExistingProven` therefore remains false and
the production policy remains backup-first `PRESERVE_THEN_PROMOTE` whenever a
prior final exists.

The following host-capability requirements are closed by this report and the
verified empty post-run inventory.

| Capability | Observation to record | Status |
| --- | --- | --- |
| Disposable create/write | Unique text and binary probe entries were created and written in the generated child only. | PASS |
| `entry.delete()` | Lookup after delete was unreadable; complete cleanup succeeded. | PASS |
| `folder.renameEntry()` | Same-folder rename available; re-lookup returned a different object. | PASS |
| `entry.moveTo()` | Same-folder move available; re-lookup returned a different object. | PASS |
| Rename/move collision | Both replaced the disposable destination; atomic/safe replacement remains explicitly unproven. | PASS, limited |
| `entry.size` | Size inspection and immediate/fresh-lookup refresh were unavailable. | PASS, characterized limitation |
| `entry.read()` | Binary read returned `ARRAY_BUFFER`; bounded header reads were unavailable. | PASS, characterized limitation |
| PSD/JPEG signatures | PSD `8BPS` and JPEG SOI were readable from disposable binary probes. | PASS |
| Cleanup | Generated child and all artifacts were absent after completion. | PASS |

## RT-01 operator procedure — prepared, not executed

Authoritative scenario: **Save Copy PSD success — verified staging is safely
committed; no staging remains.** This is distinct from the capability
characterization and remains PENDING.

### Deterministic observation boundary

No synchronization or timing hook is required. Do not inspect or interrupt the
run while Photoshop owns the save. Wait for all three deterministic signals:

1. the Debug Log records `ALB045_SAVE_COPY_TERMINAL_COMMITTED`;
2. the batch panel reaches its terminal completed state; and
3. the `Process Project` control is enabled again.

Only then capture the final filesystem inventory. Finder timing is not a
transaction boundary and must not be used to guess completion.

### Setup

1. Create a new empty external folder named
   `AlbumAI-ALB045-RT01-Disposable` outside every real AlbumAI project.
2. Put only disposable copies in it: one copied PSD template and enough copied
   photos to fill that template's configured placements. Never use originals.
3. Create a new AlbumAI project inside this disposable root, select its copied
   photo folder, register only the copied PSD, and confirm registry preflight is
   READY.
4. Confirm `Output/Processed` contains no file with the copied template's final
   PSD name. If it exists, stop and use a newly created disposable project;
   existing-final replacement belongs to RT-08.
5. In AlbumAI, enable `Auto Save`, select `Save Copy`, and disable `Export`.
6. Record Photoshop version, UXP Developer Tool version, plugin commit/build,
   copied fixture names, registered-template count, photo count, and the initial
   complete inventory of the disposable project and `Output/Processed`.
7. Clear the UXP Debug Log and take screenshots of the READY preflight, the
   Auto Save/Export controls, and the empty initial `Output/Processed` state.

### Execute and observe

1. Click `Process Project` exactly once. Do not request cancellation, close a
   document, edit files in Finder, or click Process Project again.
2. Allow Photoshop to finish. Wait for the three deterministic terminal signals
   above; do not use elapsed time as evidence.
3. Capture the complete ordered Save Copy diagnostic sequence. A successful
   run includes `TRANSACTION_BEGIN`, `STAGING_CREATED`, `HOST_WRITE_BEGIN`,
   `HOST_WRITE_END`, `STAGING_VERIFIED`, `PROMOTION_BEGIN`, `PROMOTION_END`,
   `FINAL_VERIFIED`, and `TERMINAL_COMMITTED`, each prefixed by
   `ALB045_SAVE_COPY_`.
4. Capture the terminal panel and Debug Log showing Auto Save `SAVED`, the
   expected safe output display name, one committed output, zero commit unknown,
   and zero cleanup required. For this one-template fixture there must be no
   failed or pending template.
5. After the terminal signals, capture Finder inventories for
   `Output/Processed` and the complete disposable project. The expected final
   inventory contains exactly the final copied-template PSD and contains no
   AlbumAI staging or backup entry.
6. Open that final copied PSD in Photoshop, confirm it opens without repair or
   corruption warning, and visually confirm the expected copied photos were
   placed. Capture the open document and Layers panel, then close it without
   modifying the file.
7. Capture final document/queue diagnostics and the output recovery rows. No
   native path, token, entry, host object, or raw error may appear.

### Result criteria

PASS requires the complete diagnostic sequence, a terminal `COMMITTED` output,
Auto Save `SAVED`, the expected readable PSD, no staging/backup artifact, zero
commit-unknown and cleanup-required counts, consistent panel/Debug Log totals,
and no document or queue leak.

FAIL applies if a final name is visible before verified promotion, the final
PSD is missing/unreadable/corrupt, staging or backup remains after reported
normal success, the result overstates commitment, summaries disagree, or any
user file is touched.

INCONCLUSIVE applies if the build/fixture identity was not captured, the Debug
Log omits a required boundary, the operator changes the filesystem during the
run, Photoshop/plugin terminates before a safe result is recorded, or the final
inventory cannot be established. Do not infer success from the presence of a
final-named file alone.

### Cleanup after evidence capture

Close disposable documents without saving further changes. Retain the
disposable root only until screenshots, logs, and inventories are secured;
then move that entire explicitly named disposable root to Trash. Never delete
individual entries from any real project or source-photo folder.

## Evidence record template

For every executed scenario record:

```text
Photoshop:
UXP:
Plugin commit/build:
Fixture:
Finalization strategy:
Initial final-output state:
Capability facts used:
Cancellation timing:
Transaction state / cancellation state / reason code:
Recovery retry disposition:
Final safe inventory:
Document and queue diagnostics:
Result: PASS | FAIL | BLOCKED
Notes:
```

## Completion gate

ALB-045 runtime verification may be marked complete only after every scenario
has either a Photoshop runtime PASS or an explicitly approved documented host
limitation with deterministic safe fallback coverage. Harness PASS is recorded
separately and is not silently promoted to runtime PASS.

As of 2026-08-07, RT-14 and the field-by-field host-capability
characterization are `PASS / CLOSED` with accepted Photoshop/UXP evidence.
RT-03 still lacks retained Photoshop runtime evidence. RT-06 and the
injected-failure scenarios have deterministic harness coverage but remain
runtime-not-run because no safe deterministic Photoshop failure trigger was
used. The overall verification status therefore remains `PARTIAL`. A
destructive test must never be substituted for missing failure-injection
evidence.
