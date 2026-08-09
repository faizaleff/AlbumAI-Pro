# ALB-052 — Remaining v1.0.1 Product Hardening

## Goal

Close the remaining deterministic v1.0.1 hardening gaps without claiming
Photoshop runtime evidence that was not executed. Baseline:
`main@b0b2262`.

## Result

- Project startup now validates the supported project schema, required identity,
  and structured registry/recovery fields before activation.
- Invalid primary metadata restores only a schema-valid backup. A project from a
  newer schema stops safely and is never silently replaced by an older backup.
- Persisted batch recovery is validated before normalization. Malformed data is
  classified `INVALID`, exposes detached reasons, and cannot enter automatic
  resume or retry.
- Invalid/unreadable PSD structure failures close an AlbumAI-owned Photoshop
  document. If host close fails, the owned reference is retained and the
  operator receives explicit manual-remediation wording.
- Duplicate project UI actions are blocked while one project action is active.
  Duplicate Auto Save and export calls for the same document/output mode share
  one in-flight promise and therefore one host/output transaction.
- Existing guards were verified for template mutation, photo-folder change,
  project batch, retry, and resume actions.

## Deterministic evidence

The focused ALB-052 suite adds nine scenarios covering project schema failure
and backup recovery, malformed recovery, both PSD cleanup outcomes, save/export
deduplication, and operator UI guards. `Architecture/ALB-052_HARDENING_POLICY.json`
keeps the criteria, duplicate-action audit, runtime boundary, and release
handoff machine-verifiable.

## Runtime boundary

ALB-045 RT-03 remains **harness pass / runtime not repeated**. There is no safe
deterministic Photoshop procedure that guarantees cancellation before output
transaction startup, so ALB-052 does not manufacture a timing or filesystem
failure.

The disposable-fixture scenarios `ALB-051-RT-01` and `ALB-051-RT-02` remain
**PENDING_ALB_053**. They cover the full Photoshop workflow and final
document/queue cleanup in release qualification.

## Release checklist handoff

| Gate | ALB-052 status |
| --- | --- |
| Deterministic suite and policy gates | PASS |
| Production build | PASS |
| Reproducible package and audits | PASS |
| Photoshop/UXP regression matrix | PENDING ALB-053 |
| Version, changelog, release notes, checksum, tag | PENDING ALB-053 |
| Final clean release tree and sign-off | PENDING ALB-053 |

Automated and runtime evidence remain distinct; ALB-053 owns only the pending
release-qualification work.

## Verification

| Check | Result |
| --- | --- |
| Existing deterministic tests | PASS — 142 assertions |
| ALB-051 regression scenarios | PASS — 11 assertions |
| ALB-052 hardening scenarios | PASS — 9 assertions |
| Architecture policy | PASS — 197 assertions, 95 reachable files |
| Regression policy | PASS — 699 assertions, 95/95 active files reached |
| Hardening policy | PASS — 89 assertions |
| Combined deterministic checks | PASS — 1,147 assertions |
| Production build | PASS — zero warnings, 516 KiB bundle |
| Repeated build byte identity | PASS |
| Reproducible release package | PASS — 150,643 bytes |
| Release SHA-256 | `653316ddea2a862f0c9b0491a558a938298b7b5c0212647e7f42ebc8c6056d22` |
| Full and production dependency audits | PASS — 0 vulnerabilities |
| Dependency graph | PASS |
| Clean locked install | PASS — 214 packages |
| Whitespace validation | PASS |
