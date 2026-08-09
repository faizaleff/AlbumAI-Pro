# ALB-049 — Reproducible release packaging and obsolete ZIP cleanup

## Goal

Produce a minimal, byte-reproducible AlbumAI Pro release package with a
verifiable checksum and machine-readable inventory, while removing the invalid
historical archive from source control.

## Packaging contract

`npm run package:release` performs a strict production build and then writes
three files to `com.albumai.pro/release/<version>/` by default:

- `AlbumAI-Pro-<version>.zip`
- `AlbumAI-Pro-<version>.zip.sha256`
- `AlbumAI-Pro-<version>.zip.inventory.json`

`--output-dir <path>` selects an external destination such as
`$HOME/Documents/AlbumAI-Releases/1.0.0`. Generated release directories are
ignored and release binaries are not tracked in Git.

The ZIP root is allowlisted to exactly these nine files:

- `LICENSE`
- `index.html`
- `index.js`
- `index.js.LICENSE.txt`
- `manifest.json`
- `icons/icon_D.png`
- `icons/icon_D@2x.png`
- `icons/icon_N.png`
- `icons/icon_N@2x.png`

The packager rejects a production `dist/` with missing or unexpected files and
rejects `.DS_Store`, `__MACOSX`, source, tests, dependencies, staging files,
backup files, and unsafe paths. It also requires the package, lockfile root,
and UXP manifest versions to match and requires the plugin id
`com.albumai.pro`.

## Reproducibility controls

- archive entries are sorted by normalized UTF-8 path;
- every entry uses the fixed ZIP timestamp `1980-01-01 00:00:00`;
- every entry uses normalized regular-file mode `0644`;
- compression method and level are fixed;
- directory entries, platform metadata, comments, extra fields, and enclosing
  folders are omitted;
- the supported Node.js/npm toolchain remains pinned by `.nvmrc`, `engines`,
  and `packageManager`.

`npm run package:verify` creates two independent packages in disposable
directories and requires identical ZIP bytes, SHA-256 hashes, inventories,
entry paths, timestamps, and checksum sidecars.

## Obsolete artifact

The tracked repository-root `com.albumai.pro.zip` was an invalid development
snapshot containing source, tests, `node_modules`, `.DS_Store`, `__MACOSX`, and
stale build output. ALB-049 removes it from source control. The previously
published external `AlbumAI-Pro-1.0.0.zip` and its checksum are not modified.

## Verification result

**PASS — 2026-08-09**

Verification used Node.js 24.14.0, npm 11.9.0, and a disposable npm cache.

| Check | Result |
| --- | --- |
| Clean `npm ci` | PASS — 214 packages installed |
| Existing deterministic tests | PASS — 133 assertions |
| ALB-049 packaging tests | PASS — 9 assertions |
| Strict production build | PASS — zero warnings |
| Independent package comparison | PASS — byte-identical ZIPs |
| `AlbumAI-Pro-1.0.0.zip` | PASS — 149,002 bytes |
| ZIP SHA-256 | `c02d5ae682709f3c2508f3cb45cda25e79507e88d16bd633864c5cb15c6996d5` |
| ZIP structural test | PASS — all nine entries valid |
| SHA-256 sidecar check | PASS |
| JSON inventory check | PASS |
| Full and production npm audits | PASS — 0 advisories |
| Dependency graph | PASS |
| Tracked `dist/` reproducibility | PASS |

Application source and runtime behavior are unchanged. The packaged runtime
files are byte-for-byte inputs from the verified production build, so no new
Photoshop/UXP runtime test is required for ALB-049.
