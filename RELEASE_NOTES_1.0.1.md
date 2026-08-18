# AlbumAI Pro 1.0.1

- Version: 1.0.1
- Release date: 2026-08-18
- Package: `AlbumAI-Pro-1.0.1.zip`
- Package size: 180,683 bytes
- SHA-256: `6bf15d7f5a2a60adc5b05a7417d3e19afe54de96f69374435193860c96035cf4`

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

## Major Release Highlights

- **Photo Browser & Query Engine (ALB-060)**: Multi-criteria searching (filename, date range, rating, orientation, aspect ratio) with persistent decisions.
- **Duplicate & Scale Engine (ALB-061)**: Perceptual duplicate detection, memory-bounded thumbnail caching, and 10k+ photo library support.
- **Local AI Policy Architecture (ALB-070)**: 100% on-device deterministic AI engine with zero cloud leakage.
- **Burst Grouping & Quality Signals (ALB-071)**: Timestamp-based burst grouping, Laplacian variance sharpness, exposure, and contrast analyzers.
- **Photo Culling Workflow (ALB-072)**: Keep/Reject status lifecycle, Auto-Pick Best in Burst, and side-by-side comparison modal.
- **Face Detection & Facial Horizon (ALB-073)**: Local $YC_bC_r$ skin chrominance face detection, weighted centroid horizon calculation, and face-aware crop focus.
- **Canonical Album Schema (ALB-080)**: V2 Album Domain, ordered Sheet model, Smart Object slot mappings, and 20-step undo/redo snapshot history.
- **Interactive Album Designer (ALB-081)**: HTML5 drag-and-drop live Spread Canvas, crop focus cycling, and Sheet Storyboard Strip with reordering.
- **Smart Auto-Flow Engine (ALB-082)**: Automatic chronological burst placement, hero spread selection, orientation matching, and AutoFlowModal.
- **Print Export & Proofing (ALB-090)**: 300 DPI Lab Print Profiles (12x12", 12x18", 10x10", 8.5x11"), 0.125" bleed margin geometry, preflight DPI inspector, and watermarked multi-page PDF proof sheets.
- **Batch Render Execution (ALB-091)**: Direct multi-sheet Photoshop batch render and export execution with live spread progress reporting.
- **User-Friendly 3-Mode Workflow (ALB-101)**: Segmented workspace navigation (Library, Album Designer, Proof & Export) with actionable empty states.
- **Adobe Bridge Quality Photo Engine (ALB-102)**: Up to 100MP professional camera file decode support, crisp full-resolution preview generation, streamlined 2-row toolbar, and immediate RGB buffer garbage collection for ultra-low memory footprint.

## Qualification

- 31 deterministic test suites passed (100% pass rate)
- Architecture verification: PASS — 114 reachable runtime files (234 assertions)
- Regression verification: PASS — 114/114 active files reached (911 assertions)
- Hardening verification: PASS — 89 assertions
- Production build: PASS — zero warnings (649 KiB clean bundle)
- Reproducible package verification: PASS (`AlbumAI-Pro-1.0.1.zip`)
- Full and production dependency audits: PASS — zero vulnerabilities
