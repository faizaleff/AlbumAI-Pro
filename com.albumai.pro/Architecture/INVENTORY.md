# AlbumAI Pro — Canonical Architecture Inventory

## Source of truth

ALB-050 establishes one production source graph rooted at `src/index.jsx`.
`webpack.config.js` has that single source entry, `plugin/manifest.json` loads
`index.html`, and `plugin/index.html` loads the generated `index.js` bundle once.

The machine-readable source of truth is
`Architecture/ALB-050_ARCHITECTURE_POLICY.json`. It records the exact baseline
classification from `main@7890bd6`:

| Baseline classification | Files | ALB-050 disposition |
| --- | ---: | --- |
| Reachable from `src/index.jsx` | 95 | ACTIVE |
| Unreachable JS/JSX/CSS | 341 | DELETE |
| Total first-party JS/JSX/CSS | 436 | Fully classified |

`npm run architecture:verify` rebuilds the local static import graph and fails
if an active file disappears, an unreachable source file is added, an alternate
bootstrap returns, a retired file reappears, or a canonical owner/adapter leaves
the runtime graph.

## Startup path

1. UXP reads `plugin/manifest.json` and opens `plugin/index.html`.
2. `plugin/index.html` loads the webpack-generated `index.js` exactly once.
3. webpack builds that bundle only from `src/index.jsx`.
4. `src/index.jsx` installs the `selectAllPhotos` command, plugin lifecycle
   diagnostics, and the `albumai` panel.
5. `PanelController` mounts `AlbumBrowser`, which renders the active application
   through `OpenFolder` and `AppController`.

There is no second source entry, application bootstrap, container bootstrap,
service registry bootstrap, React provider bootstrap, or alternate UI router.

## Active domains

The canonical graph contains 95 exact files. The JSON policy lists every path;
the principal areas are:

| Area | Responsibility |
| --- | --- |
| `src/app` | UI-facing application orchestration |
| `src/components`, `src/panels`, `src/controllers` | Active React/UXP panel |
| `src/services` | Project, photo, template, thumbnail, save, and export services |
| `src/project` | Template queue, batch, recovery, and output transactions |
| `src/placement` | Deterministic assignment and replacement execution |
| `src/core/document`, `src/core/layers`, selected `src/core/album` | Photoshop document/layer adapters |
| selected `src/core/photoshop` | Modal execution, BatchPlay, constants, errors, logging |
| `src/models`, `src/cache`, `src/queue`, `src/utils` | Active support primitives |

## Inactive-source decision

Every one of the 341 baseline-inactive files is recorded individually under
`inactiveDisposition.delete` in the JSON policy. None was reachable from the
production entry, none was needed to preserve the current runtime, and the
alternate stacks contained incompatible project/template/album models, missing
imports, duplicate bootstraps, and unimplemented feature claims.

The classification result is therefore:

- `migrate`: 0 — no inactive behavior was required by the live product;
- `retainTemporarily`: 0 — retaining unreachable product source would preserve
  competing ownership and unsupported feature claims;
- `delete`: 341 — removed in ALB-050, with Git history as the reversible record.

The deleted families include the alternate `src/App.jsx`, `src/index.js`,
`src/main.js`, `src/main.jsx`, `src/bootstrap.js`, container/bootstrap stacks,
84-file alternate `core/album` orchestration, legacy `engine`, alternate `ui`,
and duplicate controller/service/configuration/domain implementations.

## Photoshop boundary

Photoshop access is retained only through reachable adapters listed in the JSON
policy: `DocumentManager`, `SmartObjectService`, `LayerBoundsService`,
`LayerTransformService`, `ExecuteModal`, and `BatchPlay`. Higher-level project,
placement, batch, output, and recovery code consumes these adapters; inactive
competing Photoshop and smart-object stacks are removed.

## Claims boundary

Only behavior reachable from `src/index.jsx`, covered by the active build, and
represented by the canonical domain owners may be described as implemented.
Deleted AI, designer, editing, typography, alternate album-generation, and
alternate export stacks remain roadmap ideas, not product capabilities.
