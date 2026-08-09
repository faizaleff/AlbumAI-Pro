# ALB-050 — Active Architecture Consolidation

## Goal

Replace the stale, conflicting source inventory with one enforceable AlbumAI Pro
runtime architecture. The production behavior must remain unchanged while all
unreachable alternate bootstraps, duplicate domain models, and speculative
orchestration stacks are removed.

Baseline: `main@7890bd6afec2b67119fd7ff348a605d5231009b4`.

## Baseline evidence

A production webpack stats build and an independent static import traversal
both establish the same source inventory:

| Classification | Files |
| --- | ---: |
| First-party JS/JSX/CSS | 436 |
| Reachable from `src/index.jsx` | 95 |
| Unreachable from `src/index.jsx` | 341 |

The prior `Architecture/INVENTORY.md` listed only 24 active files and treated
several now-live project, placement, batch, transaction, recovery, and UI files
as inactive. It could not be used as the post-ALB-045 architecture contract.

## Consolidation result

- `src/index.jsx` is the only source entry.
- The UXP startup chain is manifest → `index.html` → generated `index.js` →
  `src/index.jsx`.
- All 95 active files remain byte-unchanged.
- All 341 inactive source files are deleted: 44,859 unreachable lines.
- Every deleted path is individually recorded in
  `Architecture/ALB-050_ARCHITECTURE_POLICY.json` and remains recoverable from
  Git history.
- No inactive file required migration or temporary retention because none was
  part of the production or existing regression graph.
- Seven canonical state owners are selected: Project, Photo, Template,
  Placement, Batch, Output Transaction, and Recovery.
- Six reachable Photoshop adapters define the host boundary.
- Unsupported AI, designer, editing, typography, alternate album-generation,
  and alternate export code is no longer present as unreachable product source.

## Automated architecture gate

`npm run architecture:verify` parses local imports from the canonical entry and
enforces:

- the exact 95-file reachable graph;
- the complete 436-file baseline classification;
- absence of every retired inactive path;
- one distinct reachable owner per active state domain;
- reachable Photoshop adapter boundaries;
- one webpack source entry, one UXP HTML startup document, and one generated
  bundle script load.

The gate is part of `npm test` and therefore GitHub Actions CI.

## Verification

| Check | Result |
| --- | --- |
| Architecture policy | PASS — 197 assertions, 95 reachable files |
| Existing deterministic tests | PASS — 142 assertions |
| Combined deterministic checks | PASS — 339 assertions |
| Production build | PASS — zero warnings, 510 KiB bundle |
| Reproducible release package | PASS — 149,002 bytes |
| Release SHA-256 | `c02d5ae682709f3c2508f3cb45cda25e79507e88d16bd633864c5cb15c6996d5` |
| Full dependency audit | PASS — 0 vulnerabilities |
| Production dependency audit | PASS — 0 vulnerabilities |
| Dependency graph | PASS |
| Tracked `dist` reproducibility | PASS — no byte changes |
| Clean dependency-free copy | PASS — 214 packages installed and full pipeline repeated |
| Whitespace validation | PASS |

No active source, runtime behavior, manifest, build configuration, dependency,
or generated output changed. Photoshop/UXP runtime testing is not required for
ALB-050; this ticket removes only code that the runtime could not reach.
