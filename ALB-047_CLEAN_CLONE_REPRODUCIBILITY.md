# ALB-047 — Clean-clone reproducibility and repository hygiene

## Goal

Make a fresh AlbumAI Pro checkout install, test, and build from the lockfile
without relying on committed dependencies or Adobe starter metadata.

## Scope

- Stop tracking `com.albumai.pro/node_modules/` and keep dependency trees
  ignored.
- Identify the npm package as AlbumAI Pro and pin the supported Node/npm
  toolchain.
- Make the default build production-safe while retaining explicit development
  and watch commands.
- Replace the Adobe starter README with project-specific setup, test, build,
  and Photoshop loading instructions.
- Ignore common OS, npm diagnostic, and local editor metadata.

The tracked `com.albumai.pro.zip` is not changed here because its replacement
and removal are explicitly owned by ALB-049. Source code, runtime behavior,
dependency versions, and Photoshop output behavior are also unchanged.

## Supported toolchain

- Node.js 24.14.x (`.nvmrc`: `24.14.0`)
- npm 11.9.x (`packageManager`: `npm@11.9.0`)

This is the clean-clone baseline used for ALB-047 verification. Toolchain
upgrades and dependency-advisory remediation are owned by ALB-048.

## Verification contract

ALB-047 passes only when a dependency-free checkout can run:

```bash
npm ci
npm test
npm run build:prod
git diff --check
```

Expected evidence:

- no tracked path exists under `com.albumai.pro/node_modules/`;
- all 133 or more deterministic assertions pass;
- the production build exits successfully;
- package metadata and lockfile root metadata agree;
- no Photoshop/UXP runtime test is required because runtime code is unchanged.

## Verification result

**PASS — 2026-08-09**

Verification ran from a dependency-free copy of the exact ALB-047 working tree
using Node.js 24.14.0, npm 11.9.0, and a new disposable npm cache.

| Check | Result |
| --- | --- |
| Dependency tree absent before install | PASS |
| `npm ci` | PASS — 318 packages installed from the lockfile |
| `npm test` | PASS — 133 assertions |
| `npm run build:prod` | PASS |
| Production `dist/index.js` | 521,793 bytes |
| Tracked `node_modules` after the proposed change | 0 files |

The production build retains the three previously documented webpack bundle
size warnings. Deprecated build-time packages reported during installation are
unchanged and remain ALB-048 scope. No runtime dependencies, application source
files, or Photoshop behaviors changed, so Photoshop/UXP testing is not
applicable to ALB-047.
