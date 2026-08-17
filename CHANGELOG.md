# Changelog

All notable changes to AlbumAI Pro will be documented in this file.

## [1.0.1] - 2026-08-18

### Added

- **Photo Browser & Search (ALB-060)**: Multi-criteria search (name, date range, rating, orientation, aspect ratio) with persistent decisions
- **Duplicate & Scale Engine (ALB-061)**: Perceptual duplicate detection, memory-bounded thumbnail cache, and 10k+ photo library scale architecture
- **Local AI & Privacy (ALB-070)**: 100% on-device AI policy architecture with deterministic license gating
- **Burst Grouping & Quality Signals (ALB-071)**: Timestamp-based burst grouping, Laplacian variance sharpness, exposure, and contrast analyzers
- **Photo Culling Workflow (ALB-072)**: Keep/Reject status lifecycle, Auto-Pick Best in Burst, and side-by-side comparison modal
- **Face Detection & Facial Horizon (ALB-073)**: Local $YC_bC_r$ skin chrominance face detection, weighted centroid horizon calculation, and face-aware crop focus
- **Canonical Album Schema (ALB-080)**: V2 Album Domain, ordered Sheet model, Smart Object slot mappings, and 20-step undo/redo snapshot history
- **Interactive Album Designer (ALB-081)**: HTML5 drag-and-drop live Spread Canvas, crop focus cycling, and Sheet Storyboard Strip with reordering
- **Smart Auto-Flow Engine (ALB-082)**: Automatic chronological burst placement, hero spread selection, orientation matching, and AutoFlowModal
- **Print Export & Proofing (ALB-090)**: 300 DPI Lab Print Profiles (12x12", 12x18", 10x10", 8.5x11"), 0.125" bleed margin geometry, preflight DPI inspector, and watermarked multi-page PDF proof sheets
- **Batch Render Execution (ALB-091)**: Direct multi-sheet Photoshop batch render and export execution with live spread progress reporting

### Fixed & Hardened

- Hardened thumbnail decode, refresh, bounded-cache, and stale-result handling
- Made photo-folder changes transactional with deterministic rollback
- Added template registry preflight and missing-template recovery safeguards
- Finalized transactional Save Copy PSD and PSD/JPEG export promotion
- Blocked ambiguous or cleanup-failed output transactions from automatic retry
- Validated persisted project and batch-recovery schemas before activation
- Closed AlbumAI-owned documents after invalid/unreadable PSD failures
- Prevented duplicate project, batch, Auto Save, and export actions

### Verification

- 31 deterministic test suites passed (100% pass rate)
- Architecture verification passed with 114 reachable runtime files (234 assertions)
- Regression verification passed with 114/114 active files reached (911 assertions)
- Hardening verification passed with 89 assertions
- Production build completed with zero warnings (642 KiB clean bundle)
- Full and production dependency audits reported zero vulnerabilities
- `AlbumAI-Pro-1.0.1.zip` is 179,588 bytes
- SHA-256: `fe94100d63b30e2f4fd7ec778dc9c676bfe0007b42146d4cd957633268ef840c`

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
