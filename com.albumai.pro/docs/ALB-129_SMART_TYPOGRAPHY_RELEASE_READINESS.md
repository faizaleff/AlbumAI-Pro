# ALB-129 — Smart Typography Release Readiness

Status: delivered; ready for a new version selection.

## Objective

Turn the completed ALB-118 through ALB-128 Smart Typography line into one
fail-closed release-readiness boundary. ALB-129 does not republish or mutate the
immutable `v1.1.2` release and does not choose the next public version.

## Acceptance contract

- Run ALB-118 through ALB-128 through one canonical test command.
- Require the ALB-128 Photoshop evidence packet, final Summary, and Debug Log.
- Require exact package, manifest, plugin, Photoshop host, build, and runtime
  revision identity.
- Keep the runtime offline without network or process-launch permission.
- Enforce the strict 740 KiB production-bundle ceiling.
- Reject any temporary ALB-128 qualification hook in source or bundle.
- Preserve published-version immutability. When the current version already has
  a Git tag, report `READY_FOR_VERSION_BUMP` instead of packaging over it.
- Keep deterministic package and direct-distribution verification as separate
  mandatory release gates.

## Commands

```text
npm run test:smart-typography
npm run test:alb129
npm run smart-typography:release:verify
npm run verify
npm run package:verify
npm run distribution:verify
```

## Runtime boundary

ALB-128 already captured the required installed Photoshop evidence for the
feature line. ALB-129 requires a clean package/install/startup smoke test only
after a new version and candidate identity are explicitly selected. Until then,
the published `v1.1.2` package and release assets remain untouched.

## Qualification — 2026-08-31

- Canonical ALB-118 through ALB-128 Smart Typography suite: PASS (11 suites).
- ALB-129 fail-closed readiness suite: PASS (15 assertions), including network
  permission, missing evidence, temporary hook, omitted suite, oversized bundle,
  and manifest-drift rejection cases.
- Full `npm run verify`: PASS.
- Architecture: PASS (260 assertions; 122 reachable source files).
- Regression graph: PASS (1,127 assertions; 122/122 active files reached).
- Product hardening: PASS (89 assertions).
- Production build and bundle identity verification: PASS; 757,666 bytes,
  SHA-256 `aa1c0aab8f0839ba493c51b43d6fd9cee250e35ec9ff9a95d8e282e59b349d0b`.
- Strict bundle budget: PASS with 94 bytes of remaining headroom under 740 KiB.
- Disposable release-package verification: PASS; reproducible ZIP 203,565
  bytes, SHA-256
  `37cadcfcb8a38abca8cdab6d4c66631c0cb6e066eac3d0a77ef2c9612fa3117f`.
- Direct distribution verification: `READY_FOR_UDT_PACKAGE`, eight allowlisted
  runtime files, Photoshop-only manifest, and no network permission.
- Final ALB-129 gate: `READY_FOR_VERSION_BUMP`; `v1.1.2` was detected as an
  existing immutable tag, so the safe next action is
  `SELECT_AND_APPLY_A_NEW_VERSION_BEFORE_PACKAGING`.

The consolidated gate exposed three obsolete exact-copy UI assertions in the
ALB-052, ALB-122, and ALB-124 suites. They now assert the current authoritative
recovery guidance and actual font/style selector wiring instead of removed help
sentences. No production runtime source changed in ALB-129, so the installed
ALB-128 Photoshop evidence remains authoritative until a new candidate identity
is built.
