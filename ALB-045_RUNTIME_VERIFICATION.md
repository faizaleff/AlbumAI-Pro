# ALB-045 Runtime Verification — Transactional Output Finalization and Cancellation-Safe Save/Export

Status: **PENDING — planning/host-capability characterization only**
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

## Scenario matrix

| ID | Scenario | Expected contract | Status |
| --- | --- | --- | --- |
| RT-01 | Save Copy PSD success | Verified staging is safely committed; no staging remains. | PENDING |
| RT-02 | JPEG export success | Verified staging is safely committed; no staging remains. | PENDING |
| RT-03 | Cancellation before output transaction | No staging/final output is created; retry is available. | PENDING |
| RT-04 | Cancellation during Save Copy | Host write is awaited; final result is either committed or deterministically uncommitted/cleaned. | PENDING |
| RT-05 | Cancellation during JPEG export | Same deferred-cancellation contract as RT-04. | PENDING |
| RT-06 | Host write failure with no existing final | No final output; staging is cleaned or explicitly classified. | PENDING |
| RT-07 | Host write failure with existing final preserved | Existing final remains readable and unchanged. | PENDING |
| RT-08 | Successful replacement of existing final | Prior output is preserved until new final verification; cleanup follows policy. | PENDING |
| RT-09 | Promotion failure and rollback/preservation | Prior final is restored/verified, or result is `COMMIT_UNKNOWN`; never claim success. | PENDING |
| RT-10 | Cleanup failure classification | Result is `CLEANUP_FAILED`; automatic retry is unavailable. | PENDING |
| RT-11 | Committed output followed by batch cancellation | Output remains `COMMITTED`; cancellation state is effective-after-commit; retry skips by default. | PENDING |
| RT-12 | Close/reload recovery outcome consistency | Persisted recovery and UI agree with transaction outcome and retry disposition. | PENDING |
| RT-13 | `COMMIT_UNKNOWN` remediation behavior | Resume/retry is blocked until explicit reconciliation; no validity guess. | PENDING |
| RT-14 | `OVERWRITE_ORIGINAL` cancellation contract | Successful host save remains committed and non-reversible; wording is explicit. | PENDING |
| RT-15 | Final document/queue/staging cleanup summary | No AlbumAI document/queue leak; staging/backup inventory matches terminal state. | PENDING |

## Host capability characterization

Before RT-01–RT-15, record the following against a disposable folder only.

| Capability | Observation to record | Status |
| --- | --- | --- |
| `createFile(..., { overwrite: false })` | Duplicate-name behavior and created entry metadata. | PENDING |
| `createFile(..., { overwrite: true })` | Existing-file behavior; do not infer atomicity. | PENDING |
| `entry.delete()` | Deletion result and stale-entry behavior. | PENDING |
| `folder.renameEntry()` | Same-folder rename behavior and error behavior. | PENDING |
| `entry.moveTo()` | Fallback availability and same-folder behavior. | PENDING |
| Rename/move replacement | Whether it preserves prior final on failure; atomicity remains unproven unless explicitly demonstrated. | PENDING |
| `entry.size` | Availability/timing after Photoshop write. | PENDING |
| `entry.read()` | Return type, readability, and feasible bounded verification. | PENDING |
| PSD/JPEG signatures | Whether safe bounded header/tail checks are viable. | PENDING |

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

ALB-045 runtime verification may be marked complete only after all scenarios
are PASS or have a documented, product-approved host limitation with safe
fallback behavior. A destructive test must never be substituted for a missing
capability characterization result.
