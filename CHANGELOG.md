# Changelog

All notable changes to AlbumAI Pro will be documented in this file.

## [1.1.2] - Unreleased

### Fixed and hardened

- Preserved valid completed recovery snapshots when the same selected photo is
  intentionally reused across multiple Smart Object slots.
- Restored independent vertical scrolling in the execution inspector while
  retaining the fixed photo-library workspace layout.
- Added an explicit runtime revision alongside the immutable release build ID
  so installed bundles can be identified without rewriting published history.
- Migrated the shared UXP selector adapter from deprecated `sp-dropdown`
  elements to built-in `sp-picker` elements without changing caller behavior.

### Verification

- ALB-108 automated, CCX, and installed Photoshop qualification: pending.
- Historical `v1.1.1` tag, assets, checksums, and release records remain
  immutable.

## [1.1.1] - 2026-08-21

### Fixed and hardened

- Replaced stale hardcoded panel version badges with the canonical package
  version identity.
- Added fail-closed verification for UXP Developer Tool-generated CCX packages,
  including exact inventory, manifest, runtime identity, and checksum checks.
- Established a patch-release provenance boundary so the direct-install CCX,
  source commit, build ID, tag, and release assets cannot diverge.

### Verification

- Automated qualification: PASS under ALB-098.
- Production bundle: 716,659 bytes; SHA-256
  `62a2fc71bc402b9895d60207cb7b587b3eee0a01fb8ae5abf9fc5e414b635fc8`.
- Reproducible `AlbumAI-Pro-1.1.1.zip`: 192,736 bytes; SHA-256
  `2cfe0237d468ed3a140b4fab725887ca4ab7f06df2f48d247d1d4dba24548ee9`.
- Verified `com.albumai.pro_PS.ccx`: 188,473 bytes; SHA-256
  `ec50eed854563ee445fec4772b6400a17e53211bf55a4cb6c1b02f6107b2cd3d`.
- Installed Photoshop runtime: PASS through Creative Cloud Desktop CCX
  installation, canonical `v1.1.1` badges, REC005 project reopen, photo-folder
  re-authorization, and persisted four-sheet multi-template assignments.
- Published release: https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.1.1
- Direct installer: `com.albumai.pro_PS.ccx`.

## [1.1.0] - 2026-08-21

### Added

- **Multi-Template Album Qualification (ALB-092)**: Registered `01.psd` and
  `02.psd` templates can be mapped A-B-A-B across an ordered four-spread album.
- **Exact Manual Slot Assignment (ALB-092)**: A selected Library photo can be
  assigned to stable Smart Object layer IDs, reused across slots, persisted,
  saved, and restored after project reopen.
- **Full Album Batch Render (ALB-093)**: Four ordered spreads execute six exact
  Smart Object replacements and produce deterministic `Spread_01.jpg` through
  `Spread_04.jpg` transactional outputs.
- **Runtime Bundle Verification (ALB-094)**: Production builds and release
  packages verify the running identity and reject competing static JavaScript
  bundle inputs.

### Fixed and hardened

- Preserved explicit Sheet slot bindings through placement planning instead of
  reallocating repeated photo selections.
- Normalized layer targeting across consecutive replacements in a two-slot PSD.
- Removed stale `plugin/index.js`; Webpack is now the only producer of
  `dist/index.js`.
- Replaced the obsolete runtime identity with `ALB-094-bundle-v1` and added
  deterministic source/bundle hygiene checks.

### Verification

- Architecture verification: PASS — 239 assertions, 115 reachable source files.
- Regression verification: PASS — 964 assertions, 115/115 active files reached.
- Hardening verification: PASS — 89 assertions.
- Production bundle: PASS — 716,650 bytes, zero warnings.
- Reproducible package: `AlbumAI-Pro-1.1.0.zip` — 192,731 bytes.
- Package SHA-256: `52eb9d8afe903a546ba65ab11a0a53dbdbeee763c423b431db12bd67b1f0a0dc`.
- Photoshop runtime: PASS — two-slot `01.psd`, single-slot `02.psd`, full
  A-B-A-B batch, six replacements, four JPEG outputs, and current bundle ID.

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
- **User-Friendly 3-Mode Workflow (ALB-101)**: Segmented workspace navigation (Library, Album Designer, Proof & Export) with actionable empty states
- **Adobe Bridge Quality Photo Engine (ALB-102)**: Up to 100MP professional camera file decode support, crisp full-resolution preview generation, streamlined 2-row toolbar, and immediate RGB buffer garbage collection for ultra-low memory footprint

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
- Production build completed with zero warnings (649 KiB clean bundle)
- Full and production dependency audits reported zero vulnerabilities
- `AlbumAI-Pro-1.0.1.zip` is 180,683 bytes
- SHA-256: `6bf15d7f5a2a60adc5b05a7417d3e19afe54de96f69374435193860c96035cf4`

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
