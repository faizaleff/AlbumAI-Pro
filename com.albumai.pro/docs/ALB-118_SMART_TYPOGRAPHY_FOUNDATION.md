# ALB-118 Smart Typography Foundation

## Status

Implemented as an engineering foundation. This record does not claim that
AlbumAI Pro currently changes text in Photoshop.

## Root cause

The active Template reader already discovered Photoshop text layers, but the
canonical runtime had no detached typography domain model. Adding UI or direct
Photoshop mutations at that point would have coupled product behavior to raw
host descriptors and encouraged role inference from layer names.

## Minimal change

- Added one pure typography owner at `src/typography/TypographyPlan.js`.
- Converted reader descriptors into immutable inventory slots identified only
  by exact Photoshop layer IDs.
- Added explicit `TITLE`, `CAPTION`, and `QUOTE` assignment roles without
  inferring any role from a layer name.
- Added a deterministic plan boundary that blocks missing, hidden, locked,
  duplicate, malformed, or unsupported targets.
- Kept plan output detached from Photoshop documents, layers, paths, and file
  entries.
- Exposed the inventory on the existing `Template` model while retaining its
  raw `textLayers` contract.

## Out of scope

- No UI changes.
- No Photoshop text mutation adapter.
- No font discovery or substitution.
- No text generation, local model, or network behavior.
- No new shipped product claim.

## Verification

The ALB-118 regression suite covers immutable inventory normalization,
fail-closed validation, deterministic plan ordering, editable-target rules,
preset bounds, and Template integration. The standard architecture,
regression, hardening, and production-build gates remain required.

## Next safe slice

Introduce a separately qualified Photoshop text adapter that consumes only a
READY ALB-118 plan. Runtime work must first prove exact layer targeting,
document activation safety, font availability behavior, undo grouping, and
failure recovery using disposable PSD fixtures.
