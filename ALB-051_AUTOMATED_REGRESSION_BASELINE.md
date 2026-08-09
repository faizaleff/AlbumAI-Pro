# ALB-051 — Automated Regression Baseline

## Goal

Establish a deterministic regression baseline for the canonical 95-file
AlbumAI Pro runtime before the remaining v1.0.1 hardening work. Automated
harness evidence and Photoshop/UXP runtime evidence remain explicitly
separate.

Baseline: `main@14ac65b4153bebf8a74848a8f29301702cf30f34`.

## Coverage result

- The pre-ALB-051 tests reached 80 of 95 active files.
- The ALB-051 startup/UI bundle closes the 15-file UI/bootstrap/style gap.
- The combined test graph reaches all 95 canonical active files.
- Representative empty, disabled, active, completed, failure, cancellation,
  and rollback states are exercised without changing production source.
- `Architecture/ALB-051_REGRESSION_POLICY.json` maps every v1.0.1 acceptance
  criterion to an automated gate, an explicit safe Photoshop runtime scenario,
  or both.

## Deterministic scenarios

The ALB-051 suite covers:

1. canonical UXP command/plugin/panel startup registration;
2. active UI/component loading and server-rendered empty/terminal states;
3. project create, save, close, reopen, workspace creation, and persistence;
4. photo select, range, toggle, ordered select-all semantics, and reconciliation;
5. normalized PSD layer, Smart Object, and text analysis;
6. invalid/out-of-project and unreadable PSD rejection;
7. deterministic multi-photo placement, replacement, and progress;
8. duplicate batch rejection and safe cancellation progress retention;
9. template release after terminal execution failure; and
10. atomic JSON write failure with verified rollback.

Existing ALB-043–045 and ALB-049 suites remain authoritative for photo-folder
transactions, template preflight, output transactions, recovery/retry policy,
operator states, and clean reproducible packaging.

## Photoshop runtime boundary

`ALB-051-RT-01` and `ALB-051-RT-02` are explicit **PENDING_ALB_053** release
qualification scenarios. They use only disposable copied projects and copied
PSD/JPEG fixtures. ALB-051 does not claim new Photoshop runtime evidence and
does not manufacture unsafe host or filesystem failures.

## Verification

| Check | Result |
| --- | --- |
| Existing deterministic tests | PASS — 142 assertions |
| ALB-051 regression scenarios | PASS — 11 assertions |
| Architecture policy | PASS — 197 assertions, 95 reachable files |
| Regression policy | PASS — 683 assertions, 95/95 active files reached |
| Combined deterministic checks | PASS — 1,033 assertions |
| Production build | PASS — zero warnings, 510 KiB bundle |
| Reproducible release package | PASS — 149,002 bytes |
| Release SHA-256 | `c02d5ae682709f3c2508f3cb45cda25e79507e88d16bd633864c5cb15c6996d5` |
| Full dependency audit | PASS — 0 vulnerabilities |
| Production dependency audit | PASS — 0 vulnerabilities |
| Dependency graph | PASS |
| Tracked `dist` reproducibility | PASS — no byte changes |
| Clean dependency-free copy | PASS — 214 packages installed and full pipeline repeated |
| Clean-copy `dist` identity | PASS — all eight file hashes identical |
| Whitespace validation | PASS |

No production source, dependency, runtime behavior, manifest, build
configuration, or generated output changed. The only modified pre-existing
runtime-adjacent file is the test-only UXP mock used by webpack test bundles.
