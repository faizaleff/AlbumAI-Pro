# AlbumAI Pro Roadmap

## Current release line

**1.2.0 stable — released 2026-08-31**

The verified package, checksum, inventory, and release notes are published at
[`v1.2.0`](https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.2.0).

ALB-130 qualified the candidate, ALB-131 qualified the exact public artifact,
and ALB-132 closed the published release against the source commit, runtime
identity, tag, and release assets. ALB-133 selected the next actionable
post-release milestone without changing the qualified runtime.

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
- Explicit quote and caption placement choices for existing template text
  layers, with document-safe inset anchors and grouped Undo — ALB-123
  delivered and runtime-qualified with visibly distinct anchors and grouped
  Undo evidence
- Independent template-local font and style presets, allowing safe one-click
  combinations without downloading or guessing fonts — ALB-124 delivered and
  runtime-qualified with cross-layer font/style composition and grouped Undo
  evidence
- Offline role-aware local text suggestions with explicit opt-in and no silent
  replacement — ALB-125 delivered and runtime-qualified with two-layer product
  UI application and grouped Undo evidence
- Project-local custom Title, Caption, and Quote text presets with explicit
  save, update, delete, and reuse controls — ALB-126 delivered and
  runtime-qualified with persistence, explicit application, grouped Undo,
  update, and delete evidence
- Per-storyboard-sheet typography assignment with exact template matching and
  Typography-before-output batch execution — ALB-127 delivered and
  runtime-qualified with two Smart Object replacements, two persisted text
  assignments, grouped Undo, and completed single-sheet render evidence
- Typography and multi-sheet stabilization — ALB-128 delivered and
  runtime-qualified with repeated-template sheet isolation, stale-request
  rejection, locked/hidden/missing-font safeguards, cancellation boundaries,
  save/reopen and grouped Undo, plus fail-closed output recovery evidence
- Smart Typography release readiness — ALB-129 delivered; the consolidated
  ALB-118 through ALB-128 test/evidence gate selected the safe next release
  action while preserving the immutable `v1.1.2` publication boundary
- v1.2.0 release candidate — ALB-130 delivered and qualified with candidate
  identity, production CSS bundle headroom, reproducible ZIP, verified CCX,
  Creative Cloud installation, bounded Photoshop smoke, and grouped Undo
- v1.2.0 publication readiness — ALB-131 delivered with final public identity,
  release notes, deterministic artifacts, verified Creative Cloud installation,
  installed Photoshop smoke, and explicit publication approval boundaries
- v1.2.0 stable — released 2026-08-31 at
  https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.2.0; ALB-132 release closeout
  verified the immutable tag target, release flags, published asset sizes and
  digests, and fresh-download checksums

### Distribution and collaboration

- Direct `.ccx` packaging and Creative Cloud Desktop installation — ALB-097
  delivered and runtime-qualified
- Marketplace readiness — ALB-134 in progress with an official-requirement
  audit and fail-closed gate; the bounded `v1.2.1` candidate uses temporary
  test artwork while final logo, screenshots, account facts, and qualification
  remain blocked
- Product UI finalization — ALB-135 audit complete; workspace hierarchy,
  responsive containment, panel visibility, and runtime acceptance are planned
  before permanent-logo integration or final Marketplace screenshots
- Cloud sync and team collaboration
- Mobile/client proof review

## Delivery rule

Roadmap items are not shipped claims. A capability is marked delivered only
after deterministic tests, architecture/regression/hardening checks, production
build verification, and the required Photoshop runtime evidence pass.
