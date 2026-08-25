# AlbumAI Pro Roadmap

## Current release line

**1.1.2 stable — released 2026-08-23**

The verified package, checksum, inventory, and release notes are published at
[`v1.1.2`](https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.1.2).

ALB-108 qualified the patch and installed Photoshop runtime. ALB-109 closed the
published release against the exact source commit, runtime identity, tag, and
release asset set without changing the qualified album workflow.

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

The ALB-070 local-AI architecture issue remains open because production model
licensing, representative package/latency/memory budgets, and complete host
evidence are not yet qualified. The shipped fallback remains deterministic
local signals plus manual culling.

### AI editing

- Color grading
- Portrait retouch
- Background extension
- Object removal

These features require non-destructive Photoshop adapter contracts and separate
runtime qualification before they may be presented as product behavior.

### Smart typography

- Canonical text-layer inventory and deterministic typography planning contract
  — ALB-118 foundation delivered (no user-facing text replacement yet)
- Exact Photoshop text-layer adapter with whole-plan preflight, grouped undo,
  rollback, and verification — ALB-119 engineering foundation
- Developer-console runtime qualification harness for exact two-layer plans,
  fail-closed fixture confirmation, and Undo evidence — ALB-120 runtime
  qualification passed
- Manual workflow in the existing Template panel with explicit roles,
  style-preserving text edits, exact-document safety, and grouped Undo —
  ALB-121 delivered and runtime-qualified with a two-layer Photoshop fixture
  and grouped Undo evidence
- Template-local style reuse, allowing an operator to copy an existing text
  layer's font, size, color, and alignment into another explicit assignment —
  ALB-122 delivered and runtime-qualified with cross-layer style reuse and
  grouped Undo evidence
- Quotes and caption placement
- Font and style presets
- Local text suggestions

### Distribution and collaboration

- Direct `.ccx` packaging and Creative Cloud Desktop installation — ALB-097
  delivered and runtime-qualified
- Marketplace listing identity and Adobe review after the direct-package gate
- Cloud sync and team collaboration
- Mobile/client proof review

## Delivery rule

Roadmap items are not shipped claims. A capability is marked delivered only
after deterministic tests, architecture/regression/hardening checks, production
build verification, and the required Photoshop runtime evidence pass.
