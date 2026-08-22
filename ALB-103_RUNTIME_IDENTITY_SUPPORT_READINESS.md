# ALB-103 — Runtime Identity & Support Readiness

## Objective

Make the exact AlbumAI Pro runtime easy to identify from the existing diagnostics surface so stale UXP bundles can be distinguished without relying on developer-console access.

## Root cause addressed

The plugin already logs its build ID at startup, but copied support diagnostics and the visible Execution Details panel did not include the canonical plugin ID, product version, or build ID. This made a stale installed/loaded bundle harder to distinguish from the current local build.

## Minimal scope

- Reuse the existing Execution Details panel; no new screen or workflow.
- Add compact runtime and build identity rows to the existing Project Health section.
- Include runtime identity and the canonical GitHub release reference in both Copy Summary and Copy Debug Log output.
- Add the diagnostics marker `ALB-103-runtime-identity-support-v1` without rewriting the immutable v1.1.1 release build provenance.
- Keep the source manifest free of network and external-launch permissions.
- Do not implement automatic update checks or remote metadata fetching.
- Raise the production bundle ceiling by only 1 KiB (700 KiB to 701 KiB) because the qualified v1.1.1 bundle had only 141 bytes of remaining headroom; ALB-103 adds 396 bytes net.

## Privacy and permission boundary

AlbumAI remains offline by default. The release reference is copied as plain text only. No network request is made and no new UXP permission is requested.

## Verification

- ALB-103 regression assertions
- Full `npm test`
- Architecture verification
- Regression verification
- Hardening verification
- Production build

## Runtime acceptance

1. Load the ALB-103 `dist/manifest.json` in UXP Developer Tool.
2. Open any AlbumAI project and go to Library.
3. In Inspector Preview, scroll to Execution Details.
4. Confirm the Support ID is `ALB-103-runtime-identity-support-v1`; an older installed bundle will not show this row.
5. Copy Summary and Copy Debug Log; confirm each contains the same Runtime Identity block.
