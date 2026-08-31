# AlbumAI Pro 1.2.0

- Status: released 2026-08-31
- Version: 1.2.0
- Build ID: `ALB-131-v1.2.0-release-v1`
- Runtime revision: `ALB-131-v1.2.0-publication-ready-v1`
- Release: https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.2.0
- Tag target: `5027adc97d0f208e84fa92404615556c4ffd5a5c`
- Release package: `AlbumAI-Pro-1.2.0.zip`
- Direct installer: `com.albumai.pro_PS.ccx`

## What changed

### Smart Typography

- Explicit manual Title, Caption, and Quote assignments for existing Photoshop
  text layers.
- Template-local font and style reuse without downloading or guessing fonts.
- Deterministic placement anchors with exact-document safety and grouped Undo.
- Offline role-aware text suggestions and project-local custom text presets.
- Per-storyboard-sheet typography assignments persisted with the album project.
- Typography-before-output execution for individual sheet and project batches.
- Repeated-template isolation, stale-request rejection, cancellation boundaries,
  locked/hidden/missing-font safeguards, and safe output recovery.

### Release hardening

- A deterministic CSS minification loader preserves more than 16 KiB of
  headroom under the strict 740 KiB production-bundle ceiling without adding a
  dependency.
- Runtime diagnostics expose the exact public build and runtime revision.
- Published v1.1.2 history, artifacts, checksums, and tag remain immutable.
- AlbumAI remains offline by default and requests no network permission.

## Installation

The end-user artifact is `com.albumai.pro_PS.ccx`. Open it with Creative Cloud
Desktop, approve the local third-party plugin prompt, restart Photoshop if
requested, and open **AlbumAI Browser** from Photoshop's Plugins menu. Existing
projects may require their photo folder to be selected again because UXP folder
tokens are scoped to the installed package.

## Verification state

- ALB-118 through ALB-128 Smart Typography implementation and runtime evidence:
  PASS.
- ALB-129 consolidated readiness gate: PASS.
- ALB-130 v1.2.0 candidate build, reproducible ZIP, verified CCX, Creative Cloud
  installation, installed identity, typography application, and grouped Undo:
  PASS.
- ALB-131 production bundle, deterministic suite, reproducible ZIP, verified
  CCX, Creative Cloud installation, installed identity, bounded Smart
  Typography application, and grouped Undo: PASS.
- Published ZIP: 201,617 bytes; SHA-256:
  `6fbd51bbee87df3f3c3c0072425384b93e085f91ba0f4bf22f8ffa8389b5292e`.
- Published CCX: 197,299 bytes; SHA-256:
  `9c4c22a737b51d9a961a9a9bb9272fe4aa041933332416100d21914bf4db7b47`.
- ALB-132 remote tag, release flags, GitHub asset digests and sizes, and
  fresh-download checksums: PASS. Published 2026-08-31T21:10:05Z.
- The published tag and assets are immutable.
