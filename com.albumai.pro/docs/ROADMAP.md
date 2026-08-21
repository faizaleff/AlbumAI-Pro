# AlbumAI Pro Roadmap

## Current release line

**1.1.0 release candidate — ALB-095 qualification in progress**

The product currently has one canonical Photoshop/UXP runtime and a verified
project workflow from photo import through multi-template album render and
transactional JPEG output.

## Delivered and verified

### Photo library and culling assistance

- Folder scanning, bounded thumbnail/preview decoding, metadata, cache, search,
  filters, multi-selection, ratings, favourites, and exact duplicate evidence.
- Deterministic local quality signals, burst grouping, keep/reject decisions,
  comparison, and face-aware crop focus.
- Production model inference remains disabled until the local-WASM capability,
  licensing, privacy, and runtime gates are fully qualified.

### Album designer

- Ordered multi-template registry and A-B-A-B storyboard mapping.
- Exact Smart Object slot assignment with persistence, swap, clear, crop-focus,
  drag/reorder, undo/redo, and Smart Auto-Flow.
- Manual assignment and render qualification for two-slot `01.psd` and
  single-slot `02.psd` templates.

### Photoshop automation and output

- Multi-sheet Smart Object replacement with active-document safety.
- Batch cancellation, recovery, resume, retry, and terminal document cleanup.
- Transactional Save Copy and JPEG export with deterministic spread names.
- Lab print presets, bleed geometry, preflight, and PDF proof generation.
- Reproducible allowlisted release packaging and canonical UXP bundle identity.

## Planned product phases

### AI editing

- Color grading
- Portrait retouch
- Background extension
- Object removal

These features require non-destructive Photoshop adapter contracts and separate
runtime qualification before they may be presented as product behavior.

### Smart typography

- Quotes and caption placement
- Font and style presets
- Local text suggestions

### Distribution and collaboration

- Marketplace-ready signing and installation flow
- Cloud sync and team collaboration
- Mobile/client proof review

## Delivery rule

Roadmap items are not shipped claims. A capability is marked delivered only
after deterministic tests, architecture/regression/hardening checks, production
build verification, and the required Photoshop runtime evidence pass.
