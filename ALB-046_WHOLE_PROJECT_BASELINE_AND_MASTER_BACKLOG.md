# ALB-046 — AlbumAI Pro Whole-Project Baseline and Master Backlog

Status: **AUDIT COMPLETE — IMPLEMENTATION BACKLOG READY**

Audit date: **2026-08-09**

Source of truth: **`main` at `d1e10fc`**

Product owner/runtime operator: **Faizal**

Engineering owner: **Codex**

## Purpose

This document is the authoritative whole-project baseline for AlbumAI Pro. It
replaces ticket-by-ticket planning as the primary roadmap and separates:

- working product behavior;
- partially verified behavior;
- repository and architecture debt;
- unimplemented product roadmap;
- work that requires Photoshop/UXP runtime evidence from work that Codex can
  verify automatically.

The working agreement is fixed: Codex owns planning, implementation, automated
verification, build, Git/PR preparation, and release readiness. Faizal performs
only the explicitly requested Photoshop/UXP runtime scenarios. No commit or push
is performed without Faizal's approval.

## Executive baseline

AlbumAI Pro already has a usable v1 workflow, not merely a prototype. A user can
create/open a project, manage a photo workspace, register and preflight ordered
PSD templates, assign selected photos to Smart Object slots, process multiple
templates, save/export results, cancel safely, recover interrupted work, and
retry safe failures.

The repository is not yet a dependable development or release baseline. The
active runtime is buried inside a much larger disconnected source tree,
generated dependencies and build outputs are tracked, the checked-in release
ZIP is obsolete, CI is absent, and current automated tests begin only at
ALB-043. The broad AI/product roadmap is mostly not implemented in the active
runtime.

## Evidence snapshot

| Area | Audit result | Classification |
| --- | --- | --- |
| Git baseline | Clean fresh clone of `main`; HEAD `d1e10fc` | PASS |
| Current release | `v1.0.0` points to `c67697e`; maintenance work through ALB-045 is on `main` | PASS |
| Automated verification | `npm test` passes **133** assertions after clean dependency install | PASS, limited scope |
| Production build | `npm run build:prod` passes after clean install; `index.js` is about **510 KiB** | PASS with 3 size warnings |
| Production dependency audit | `npm audit --omit=dev` reports **0** vulnerabilities | PASS |
| Full dependency audit | **39** findings: 32 high, 7 moderate, concentrated in the development/build toolchain | REMEDIATION REQUIRED |
| Clean-clone behavior | Initial test/build fails because tracked `node_modules` omits `jpeg-js`; `npm ci` repairs it | FAIL |
| Tracked files | **7,897** total; **7,395** under `node_modules` | REMEDIATION REQUIRED |
| Source inventory | **437** source files / about **64,930** lines | HIGH COMPLEXITY |
| Active runtime graph | **95** files reachable from `src/index.jsx` | AUTHORITATIVE RUNTIME |
| Inactive source | **341** JS/JSX/CSS files outside the runtime graph | CONSOLIDATE/REMOVE |
| Test reachability | Tests import/reach 80 of 95 active files; 15 UI/bootstrap/style files are outside the test graph | COVERAGE GAP |
| CI/checks | No GitHub Actions workflow or commit status on `d1e10fc` | MISSING |
| Package identity | `package.json` and README still identify the Adobe React starter | INCORRECT |
| Tracked release ZIP | `com.albumai.pro.zip` was last changed at `b11336c` and contains old source, `node_modules`, `.DS_Store`, and `__MACOSX` entries | INVALID |
| ALB-045 runtime evidence | Core success/cancellation/recovery paths passed; RT-03 lacks retained runtime evidence; safe forced-failure cases remain harness-only | PARTIAL |
| GitHub backlog | No open or closed GitHub issues; branches are `main`, `release/rc1`, and `backup-before-refactor` | BACKLOG NOT OPERATIONALIZED |

## Active product capability matrix

| Capability | Current state | Evidence/limitation |
| --- | --- | --- |
| Project create/open/close and persisted workspace | Working | Active UI and project services |
| Photo-folder open/change transaction | Working | ALB-043 automated and runtime evidence |
| Thumbnail browser, preview, multi-selection, select-all | Working | Active runtime; thumbnail hardening ALB-040–042 |
| Search and filter | Missing from active UI | Roadmap-only/alternate code is not product behavior |
| Rich metadata browsing | Partial | Basic photo identity/dimensions exist; no complete active metadata UX |
| Ordered PSD template registry | Working | Multi-template registry and persistence |
| Template validation/preflight/remediation | Working | ALB-044 automated and runtime evidence |
| PSD document/layer/Smart Object discovery | Working | Active template reader and layer tree |
| Deterministic photo assignment and replacement | Working | Placement/replacement execution pipeline |
| Multi-template batch processing | Working | Progress, outcome, and queue model |
| Duplicate batch prevention | Present | Controller rejects a second active project batch; broader concurrency audit remains |
| Live progress and safe cancellation | Working | ALB-012, ALB-033, ALB-034, ALB-045 |
| Recovery, resume, and failed-template retry | Working | Safe/blocked output disposition enforced |
| Transactional Save Copy PSD | Working | ALB-045 staging, verification, promotion, rollback |
| Transactional JPEG export | Working | ALB-045 staging, signature verification, promotion |
| Overwrite Original | Working, non-reversible | Explicitly labeled; RT-14 closed |
| Release packaging | Invalid current artifact | Old tracked ZIP is not a releasable package |
| AI culling | Not product-ready | Disconnected engines only; no active model/runtime/UX |
| Album story/layout designer | Not product-ready | Current behavior fills existing PSD slots sequentially |
| AI editing | Missing | No active color/retouch/background/object-removal workflow |
| Smart typography | Missing | Text-layer discovery is not a typography product workflow |

## Architecture decision

The only production architecture is the import graph rooted at
`com.albumai.pro/src/index.jsx`. At this baseline it contains 95 files. Code
outside that graph must never be described as a working feature merely because
classes or engines with relevant names exist.

There are three broad disconnected/competing stacks:

1. the active browser/project/template/batch runtime;
2. alternate `core/album`, `services`, `core/ui`, and related orchestration;
3. legacy `album`, `engine`, alternate bootstrap, and dashboard paths.

New feature work must extend one canonical active domain model. It must not
activate an alternate stack wholesale. Reusable primitives may be migrated with
tests; competing managers, facades, engines, state stores, and bootstraps should
be retired after dependency proof.

## Delivery strategy

The project proceeds through two release horizons:

1. **Foundation release (v1.0.1):** make the current working product clean,
   reproducible, supportable, and releaseable.
2. **Product expansion (v1.1+):** complete the Photo Library, AI, Designer,
   Editing, Typography, and final automation roadmap on the canonical runtime.

No AI feature should be started before the repository, architecture boundary,
CI, and release pipeline are reliable.

## Master backlog

### P0 — Repository and release blockers

#### ALB-047 — Clean-clone reproducibility and repository hygiene

- Remove tracked `node_modules` while retaining it in `.gitignore`.
- Verify `npm ci`, `npm test`, and production build from a dependency-free
  checkout.
- Correct `package.json` name, author, description, and project scripts.
- Replace the starter README with AlbumAI Pro setup, development, testing, and
  runtime instructions.
- Decide and document the supported Node/npm toolchain.
- Remove OS metadata and obsolete package artifacts from version control.

Acceptance: a clean clone installs, passes all 133+ checks, and builds without
depending on checked-in dependencies.

#### ALB-048 — Build-toolchain remediation and continuous integration

- Upgrade the Babel/webpack/loaders/copy stack in controlled increments.
- Remove unused `clean-webpack-plugin` and other obsolete packages where the
  current webpack configuration already replaces them.
- Resolve development dependency advisories or document a bounded exception.
- Add GitHub CI for clean install, tests, production build, diff cleanliness,
  and package validation.
- Treat warnings deliberately; establish bundle-size and warning policy.

Acceptance: CI runs on every PR; production dependencies remain clean; build
toolchain risk is reduced to an explicitly accepted level.

#### ALB-049 — Reproducible release package and checksum

- Add a clean packaging script that stages only `manifest.json`, `index.html`,
  `index.js`, license notices, and required icons.
- Reject `.DS_Store`, `__MACOSX`, source, tests, dependencies, staging files,
  and backup files.
- Generate SHA-256 and a machine-readable package inventory.
- Stop tracking the obsolete `com.albumai.pro.zip`; attach generated packages
  to releases instead.
- Verify manifest/package/version consistency.

Acceptance: two builds from the same source/toolchain create an equivalent
validated package, and the release checklist proves every included path.

### P1 — Canonical architecture and v1.0.1 stability

#### ALB-050 — Active architecture consolidation

- Replace the stale architecture inventory with the 95-file current graph.
- Classify all 341 inactive files using evidence: migrate, retain temporarily,
  or delete.
- Select canonical owners for Project, Photo, Template, Placement, Batch,
  Output Transaction, and Recovery state.
- Remove alternate bootstraps and duplicate orchestration in small reversible
  slices with import-graph and build checks.
- Keep low-level reusable Photoshop primitives only behind explicit adapters.

Acceptance: one documented startup path and one owner per active domain; no
feature claims depend on unreachable code.

#### ALB-051 — Automated regression baseline

- Add tests for project creation/open/close and startup validation.
- Add active UI/component tests for the 15 files outside the current test graph.
- Restore regression coverage for pre-ALB-043 workflows: photo selection,
  template analysis, placement, replacement, batch progress/cancel/retry, and
  persistence.
- Add clean-package validation tests.
- Add negative tests for invalid PSDs, unreadable files, duplicate execution,
  document cleanup, and atomic-write failures.

Acceptance: every v1.0.1 acceptance criterion maps to an automated check or an
explicit Photoshop runtime scenario.

#### ALB-052 — Remaining v1.0.1 product hardening

- Harden startup/project schema validation and recovery diagnostics.
- Verify invalid/unreadable PSD behavior end-to-end.
- Audit duplicate-action guards across project, template, photo-folder, retry,
  resume, save, and export operations.
- Prove Photoshop document references and queues are released on every terminal
  outcome.
- Finish empty-state, status, long-run progress, and remediation wording.
- Reconcile ALB-045 RT-03 only if a safe deterministic runtime procedure is
  available; never manufacture unsafe Photoshop failures.

Acceptance: the v1.0.1 roadmap and release checklist are closed with automated
and runtime evidence kept distinct.

#### ALB-053 — v1.0.1 release qualification

- Run the complete automated suite and CI on the release candidate.
- Run only the required Photoshop/UXP regression matrix with disposable copied
  fixtures.
- Update changelog, release notes, version, package, checksum, and Git tag.
- Confirm clean repository, no unresolved recovery state, and no document leak.

Acceptance: signed-off v1.0.1 package with reproducible inventory and evidence.

### P2 — Photo Library completion

#### ALB-060 — Search, filter, sort, and metadata UX

- Canonical metadata schema and bounded extraction pipeline.
- Filename, type, orientation, rating, favourite, and date filters.
- Deterministic sorting and result counts compatible with virtualized browsing.
- Persisted user filter state without corrupting project state.

#### ALB-061 — Library quality and scale

- Duplicate detection foundation with explainable grouping.
- Cache lifecycle, invalidation, and memory limits under large folders.
- Performance budgets and Photoshop/UXP scale fixtures.

### P3 — AI photo culling

#### ALB-070 — AI capability and privacy architecture

- Decide local versus remote inference, supported hardware/runtime, model
  licensing, consent, data handling, and failure fallback.
- Define versioned score/evidence schema before selecting models.

#### ALB-071 — Quality, face, duplicate, and event signals

- Blur/exposure/composition signals.
- Face/smile/eye quality and grouping.
- Near-duplicate and event grouping.
- Deterministic caching and model-version invalidation.

#### ALB-072 — Explainable culling workflow

- User-controlled ranking, keep/reject decisions, comparisons, and undo.
- Never delete originals; persist decisions separately from source photos.

### P4 — Album Designer

#### ALB-080 — Canonical album/template/sheet domain

- Resolve current conflicting definitions of template, page/sheet, album, and
  export job.
- Versioned project migration before new persisted fields.

#### ALB-081 — Manual designer workflow

- Story/order management, template selection, slot assignment, drag/drop, swap,
  crop focus, and undo/redo.

#### ALB-082 — Layout suggestions

- Constraint-based suggestions first; AI ranking only after deterministic
  layout validity and explainability are established.

### P5 — Editing and typography

#### ALB-090 — Non-destructive editing foundation

- Canonical edit recipe model, preview, undo, and Photoshop application boundary.
- Color/exposure/crop before retouch or generative operations.

#### ALB-091 — Advanced editing

- Retouch, background extension, and object removal with explicit provider,
  consent, cost, and fallback decisions.

#### ALB-092 — Smart typography

- Text-slot semantics, font availability, overflow detection, quotes/captions,
  and suggestion review before Photoshop mutation.

### P6 — Final automation and commercial release readiness

#### ALB-100 — End-to-end generation and print validation

- Multi-sheet PSD generation, color profile/DPI/bleed checks, naming, output
  reconciliation, and print-ready exports.

#### ALB-101 — Distribution readiness

- Installer/update path, support diagnostics, privacy/legal documentation,
  telemetry decision, crash reporting decision, licensing/payments, and Adobe
  Marketplace requirements when product scope reaches that stage.

## Definition of Done for every ticket

A ticket is complete only when all applicable items are true:

1. Scope and failure contracts are documented before risky implementation.
2. One logical feature is isolated on its own branch/commit series.
3. New behavior has deterministic automated tests.
4. `npm test`, production build, and `git diff --check` pass.
5. Modified files and generated outputs are reviewed explicitly.
6. Photoshop/UXP evidence is requested only for behavior that cannot be proven
   safely outside the host.
7. Runtime tests use disposable copied fixtures and never destructive user data.
8. Runtime PASS, harness PASS, limitation, and not-run statuses are not conflated.
9. Documentation, migration, recovery, and operator wording are updated.
10. Codex presents the exact commit/push scope and waits for Faizal's approval.

## Immediate execution order

1. Close ALB-046 documentation with review and commit approval.
2. Implement ALB-047 clean-clone reproducibility and repository identity.
3. Implement ALB-048 CI/toolchain remediation.
4. Implement ALB-049 release packaging.
5. Consolidate architecture and expand tests through ALB-050/051.
6. Finish v1.0.1 hardening and release through ALB-052/053.
7. Begin product expansion at ALB-060 only from the cleaned canonical baseline.

## Current gate

**Next engineering ticket: ALB-047.** No Photoshop testing is required for
ALB-046. ALB-047 is initially Codex-only; Faizal will be asked only for commit
and push approval after the clean-clone checks and modified-file review pass.
