# Changelog

All notable changes to AlbumAI Pro will be documented in this file.

## [1.0.1] - 2026-08-11

### Fixed

- Hardened thumbnail decode, refresh, bounded-cache, and stale-result handling
- Made photo-folder changes transactional with deterministic rollback
- Added template registry preflight and missing-template recovery safeguards
- Finalized transactional Save Copy PSD and PSD/JPEG export promotion
- Blocked ambiguous or cleanup-failed output transactions from automatic retry
- Validated persisted project and batch-recovery schemas before activation
- Closed AlbumAI-owned documents after invalid/unreadable PSD failures
- Prevented duplicate project, batch, Auto Save, and export actions

### Improved

- Added explicit output recovery/operator states and remediation wording
- Improved safe cancellation, resume, retry, progress, and outcome accounting
- Consolidated the canonical 95-file runtime architecture
- Added full 95/95 automated regression reachability
- Added deterministic product-hardening and release-policy verification
- Added clean, minimal, byte-reproducible release packaging
- Added SHA-256 sidecars and machine-readable package inventories

### Verification

- 1,147 combined deterministic assertions passed
- Architecture verification passed with 95 reachable runtime files
- Regression verification passed with 95/95 active files reached
- Production build completed with zero warnings
- Full and production dependency audits reported zero vulnerabilities
- Photoshop/UXP scenarios ALB-051-RT-01 and ALB-051-RT-02 passed using disposable fixtures
- `AlbumAI-Pro-1.0.1.zip` is 150,643 bytes
- SHA-256: `f41344ba5e4248dacbad99b1b388a60743bcb182458f1e014b673c84478247c4`

### Preserved limitation

- ALB-045-RT-03 remains harness pass / runtime not repeated because no safe
  deterministic host procedure can force its pre-transaction cancellation timing

## [1.0.0] - 2026-07-29

### Added

- Project-based batch template processing
- Smart Object photo replacement
- Sequential photo assignment
- Template registry and persisted ordering
- Photo browser with selection and preview
- Auto Save for processed PSD files
- JPEG export
- Safe batch cancellation
- Recovery and resume support
- Failed-template retry
- Missing-template detection and recovery
- Invalid PSD handling
- Live batch progress and outcome summaries
- Production release build and clean packaging

### Improved

- Template status refresh after retry
- No-photo batch preflight
- Document cleanup and live-document tracking
- Project persistence and atomic recovery checkpoints
- Production bundle size and release structure

### Known limitations

- `allowCodeGenerationFromStrings` remains required by the current UXP HTML loading path
- `copy-webpack-plugin` emits a non-blocking webpack deprecation warning
- Browser thumbnail producer can log bounded-cache diagnostic messages
