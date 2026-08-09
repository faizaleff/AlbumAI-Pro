# AlbumAI Pro

AlbumAI Pro is a Photoshop UXP plugin for project-based album production. The
current workflow manages ordered PSD templates, photo selection and placement,
transactional PSD/JPEG output, cancellation, recovery, resume, and safe retry.

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
| `npm test` | Run all deterministic ALB-043 through ALB-045 harness suites |
| `npm run build` | Create a clean production bundle in `dist/` |
| `npm run build:prod` | Create the same production bundle explicitly |
| `npm run build:dev` | Create a development bundle with source mapping |
| `npm run watch` | Rebuild the development bundle when source files change |
| `npm run verify` | Run the full harness suite and production build |
| `npm run audit:all` | Require a zero-advisory full dependency tree |
| `npm run audit:prod` | Require a zero-advisory production dependency tree |
| `npm run deps:check` | Validate the installed dependency graph |
| `npm run verify:ci` | Run tests, strict build, audits, graph validation, and generated-output cleanliness |

## Continuous integration

GitHub Actions runs on every pull request and every push to `main` using the
toolchain pinned by `.nvmrc`. CI performs a clean lockfile install, checks
committed diff whitespace, runs all deterministic tests, rejects webpack
warnings or a production entrypoint above 525 KiB, audits both the complete and
production dependency trees, validates the installed graph, and confirms that
the committed `dist/` bundle is reproducible.

## Load in Photoshop

1. Run `npm ci` and `npm run build`.
2. Open Adobe UXP Developer Tool.
3. Add `com.albumai.pro/dist/manifest.json`.
4. Load the plugin and open **Plugins > AlbumAI Browser** in Photoshop.

The `uxp:load`, `uxp:reload`, `uxp:watch`, and `uxp:debug` scripts are
available when the UXP command-line tool is installed and configured.

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
or backup files. Reproducible package generation and checksum validation are
tracked separately under ALB-049.
