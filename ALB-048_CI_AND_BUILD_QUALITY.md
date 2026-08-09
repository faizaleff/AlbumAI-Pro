# ALB-048 — Build-toolchain remediation and continuous integration

## Goal

Reduce build-toolchain risk, make warnings and bundle growth enforceable, and
run the complete clean-install verification contract on every pull request and
every update to `main`.

## Scope

- Upgrade the active Babel, webpack, loader, copy, CLI, and watch stack to
  current compatible releases.
- Replace deprecated or redundant build packages with maintained equivalents or
  webpack-native behavior.
- Resolve the complete npm advisory tree without changing application runtime
  dependencies.
- Add GitHub Actions verification for committed diff quality, lockfile install,
  tests, strict production build, audits, dependency-tree validity, and
  reproducible tracked output.
- Establish an explicit zero-warning policy and a 525 KiB production
  asset/entrypoint budget.

ALB-048 does not upgrade React, change application source/runtime behavior,
remove `com.albumai.pro.zip`, or create a release package. Reproducible release
staging, inventory, checksum, and obsolete ZIP removal remain ALB-049 scope.

## Toolchain changes

The supported Node.js 24.14.0 and npm 11.9.0 baseline remains unchanged.

| Area | Before | After |
| --- | --- | --- |
| Babel core | 7.8-era declaration | 7.29.7 |
| Babel loader | 8.4.1 resolved | 10.1.1 |
| webpack | 5.108.4 resolved | 5.109.2 |
| webpack CLI | 5.1.4 | 7.2.2 |
| Copy plugin | 5.1.2 resolved | 14.0.0 |
| CSS loader | 6.11.0 resolved | 7.1.4 |
| Style loader | 1.3.0 resolved | 4.0.0 |
| nodemon | 2.0.22 resolved | 3.1.14 |

Removed build dependencies:

- `clean-webpack-plugin`: unused; production output already uses webpack 5
  `output.clean`.
- `file-loader`: replaced by webpack 5 `asset/resource`.
- `@babel/plugin-proposal-object-rest-spread`: deprecated; replaced by the
  maintained transform plugin.
- `@babel/plugin-syntax-class-properties`: redundant with the current parser and
  did not transform output.
- legacy npm-ineffective `resolutions.acorn` entry.

Three same-major transitive overrides hold patched versions until the upstream
toolchain constraints catch up: `fast-uri` 3.1.5, `nanoid` 3.3.18, and
`postcss` 8.5.26.

## CI and build-quality contract

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` with
read-only repository permissions and one cancellable job per ref. The job:

1. checks out complete history and sets up Node from `.nvmrc`;
2. runs `git diff --check` against the event base;
3. installs the exact lockfile with `npm ci`;
4. runs all 133 deterministic assertions;
5. builds production with `--fail-on-warnings`;
6. requires zero full-tree and production npm advisories;
7. validates the installed dependency graph with `npm ls --all`;
8. rejects any uncommitted change to tracked `dist/` after rebuilding.

Webpack treats either warnings or a production asset/entrypoint above
`525 * 1024` bytes as a failed build. The ALB-048 production bundle is 521,812
bytes, leaving 5,788 bytes of explicit headroom.

## Verification result

**PASS — 2026-08-09**

Verification used Node.js 24.14.0, npm 11.9.0, and a disposable npm cache.

| Check | Result |
| --- | --- |
| Clean `npm ci` | PASS — 214 packages installed |
| Deterministic tests | PASS — 133 assertions |
| Strict production build | PASS — zero warnings |
| Production `dist/index.js` | PASS — 521,812 bytes, below 525 KiB |
| Full `npm audit` | PASS — 0 advisories |
| Production `npm audit --omit=dev` | PASS — 0 advisories |
| `npm ls --all` | PASS |
| Deprecated package warnings during clean install | PASS — none |
| Generated `dist/` reproducibility | PASS |
| Workflow YAML syntax | PASS |

The committed `dist/index.js` is refreshed as the production bundle; the prior
tracked file was a development `eval-source-map` bundle. Application source and
Photoshop behavior are unchanged, so Photoshop/UXP runtime testing is not
required for ALB-048.
