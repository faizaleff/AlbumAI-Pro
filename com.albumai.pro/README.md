# AlbumAI Pro

AlbumAI Pro is a Photoshop UXP plugin for project-based album production. The
current workflow manages ordered PSD templates, photo selection and placement,
transactional PSD/JPEG output, cancellation, recovery, resume, and safe retry.

The current stable release is **1.2.0**, published as
[`v1.2.0`](https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.2.0).
It adds the complete Smart Typography workflow, per-storyboard-sheet text
assignments, guarded Typography-before-output execution, and multi-sheet
stabilization while remaining offline by default.

ALB-130 qualified the candidate, ALB-131 qualified the exact public artifact,
and ALB-132 closed the release after verifying the immutable tag target,
published asset sizes and digests, and fresh-download checksums. The direct
installer, source commit, runtime identity, package version, tag, and release
assets share one exact provenance boundary. Published assets remain immutable.

## Requirements

- Adobe Photoshop 27.4.0 or newer
- Adobe UXP Developer Tool for local plugin loading and debugging
- Node.js 24.14.x and npm 11.9.x

The repository pins the verified local toolchain in `.nvmrc` and
`package.json`. If you use `nvm`, run `nvm use` from this directory before
installing dependencies.

## Clean setup

From `com.albumai.pro/`:

```bash
npm ci
npm test
npm run build:prod
```

Dependencies are intentionally not committed. `npm ci` installs the exact
dependency graph recorded in `package-lock.json`.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the complete deterministic ALB-043 through ALB-133 suite |
| `npm run test:smart-typography` | Run the canonical ALB-118 through ALB-128 Smart Typography suite |
| `npm run build` | Create a clean production bundle in `dist/` |
| `npm run build:prod` | Create the same production bundle explicitly |
| `npm run build:dev` | Create a development bundle with source mapping |
| `npm run watch` | Rebuild the development bundle when source files change |
| `npm run verify` | Run the full harness suite and production build |
| `npm run audit:all` | Require a zero-advisory full dependency tree |
| `npm run audit:prod` | Require a zero-advisory production dependency tree |
| `npm run deps:check` | Validate the installed dependency graph |
| `npm run verify:ci` | Run tests, strict build, audits, graph validation, and generated-output cleanliness |
| `npm run distribution:verify` | Verify direct CCX packaging readiness or an actual UDT-generated CCX |
| `npm run smart-typography:release:verify` | Require complete Smart Typography evidence and report the safe next release action |

## Continuous integration

GitHub Actions runs on every pull request and every push to `main` using the
toolchain pinned by `.nvmrc`. CI performs a clean lockfile install, checks
committed diff whitespace, runs all deterministic tests, rejects webpack
warnings or a production entrypoint above 740 KiB, audits both the complete and
production dependency trees, validates the installed graph, and confirms that
the committed `dist/` bundle is reproducible.

## Load in Photoshop

1. Run `npm ci` and `npm run build`.
2. Open Adobe UXP Developer Tool.
3. Add `com.albumai.pro/dist/manifest.json`.
4. Load the plugin and open **Plugins > AlbumAI Browser** in Photoshop.

The `uxp:load`, `uxp:reload`, `uxp:watch`, and `uxp:debug` scripts are
available when the UXP command-line tool is installed and configured.

## End-user installation

Adobe UXP plugins use `.ccx` packages for direct installation through Creative
Cloud Desktop. The current GitHub ZIP remains the reproducible development
bundle; ALB-097 qualified the direct-install path, and ALB-131 qualified the
exact `v1.2.0` ZIP and CCX. ALB-132 records the immutable publication evidence.
ALB-133 selects Adobe Marketplace readiness as the next actionable milestone
without changing the published artifacts.

## Repository layout

- `src/` — plugin application and active domain/services code
- `plugin/` — manifest, HTML, and static icons copied into the build
- `tests/` — deterministic Node.js harness suites
- `dist/` — generated/loadable UXP bundle
- repository-root `ALB-*.md` files — implementation and runtime evidence

## Verification boundary

The Node.js harnesses verify deterministic policies and service behavior. They
do not replace Photoshop/UXP runtime evidence. Runtime checks are recorded in
the corresponding `ALB-*_RUNTIME_VERIFICATION.md` document and must use copied,
disposable fixtures.

## Release artifacts

Do not package `node_modules`, source files, tests, OS metadata, staging files,
or backup files. Create the production ZIP, SHA-256 sidecar, and JSON inventory
with:

```bash
npm run package:release
```

The default output directory is `release/<version>/` and is ignored by Git.
To write directly to the external release directory used for publishing:

```bash
npm run package:release -- --output-dir "$HOME/Documents/AlbumAI-Releases/1.0.0"
```

The release ZIP has no enclosing folder. Its root contains only
`manifest.json`, `index.html`, `index.js`, the Apache and generated bundle
license notices, and the four required icons. Run `npm run package:verify` to
create two disposable packages and require byte-identical ZIPs, inventories,
and checksums.

Run `npm run distribution:verify` before using Adobe UXP Developer Tool's
**Package** action. After UDT creates a `.ccx`, pass its absolute path with
`npm run distribution:verify -- --ccx /path/to/AlbumAI-Pro.ccx` before any
installation or distribution test.
