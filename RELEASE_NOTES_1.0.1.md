# AlbumAI Pro 1.0.1

- Version: 1.0.1
- Release date: 2026-08-11
- Git tag: pending final release commit
- Release commit: pending final release commit
- Package: `AlbumAI-Pro-1.0.1.zip`
- Package size: 150,643 bytes
- SHA-256: `f41344ba5e4248dacbad99b1b388a60743bcb182458f1e014b673c84478247c4`

## Installation

1. Verify the ZIP against the SHA-256 value above.
2. Extract `AlbumAI-Pro-1.0.1.zip`.
3. Open Adobe UXP Developer Tool.
4. Add the extracted `manifest.json`.
5. Load AlbumAI Pro in Photoshop.
6. Open AlbumAI Browser from Photoshop's Plugins menu.

The archive contains exactly the production license, HTML entry point, bundle,
bundle license notice, manifest, and four required icons. Source, tests,
dependencies, staging files, backups, and platform metadata are excluded.

## Maintenance release highlights

- Transactional Save Copy PSD and PSD/JPEG output promotion
- Fail-closed recovery and retry decisions for ambiguous output state
- Clear committed, safe-retry, commit-unknown, and remediation-required states
- Transactional photo-folder changes and template-registry preflight
- Stronger project and persisted-recovery schema validation
- Invalid/unreadable PSD cleanup with explicit manual-remediation handling
- Duplicate-action guards across project, batch, Auto Save, and export actions
- Thumbnail decode/refresh and bounded-cache lifecycle hardening
- Deterministic cancellation, resume, retry, progress, and terminal accounting
- Reproducible minimal release packaging with checksum and inventory

## Qualification

- Combined deterministic verification: PASS — 1,147 assertions
- Architecture verification: PASS — 95 reachable runtime files
- Regression verification: PASS — 95/95 active files reached
- Production build: PASS — zero warnings
- Reproducible package verification: PASS
- Full and production dependency audits: PASS — zero vulnerabilities
- ALB-051-RT-01 core workflow/output scenario: PASS
- ALB-051-RT-02 document/reference cleanup scenario: PASS

Runtime qualification used disposable copied projects and copied PSD/JPEG
fixtures. The invalid PSD was rejected, terminal outcomes leaked no
AlbumAI-owned document reference, and project close cleared AlbumAI queue and
document state.

## Safety boundary

ALB-045-RT-03 remains harness pass / runtime not repeated. No safe deterministic
Photoshop procedure can guarantee cancellation before the output transaction
starts, so release qualification does not manufacture that timing condition.

## Final release action

The release commit and `v1.0.1` tag must be recorded after review. Until then,
the values above intentionally remain pending rather than claiming Git objects
that do not yet exist.
