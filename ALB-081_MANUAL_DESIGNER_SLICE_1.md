# ALB-081 — Manual Designer Workflow, Slice 1

Status: **IMPLEMENTED — PURE PERSISTED DESIGN CONTRACT**

Baseline: **`main` at `609079d`**

## Scope

Slice 1 establishes the canonical persisted state and deterministic commands
needed by a later manual-designer UI. It does not add drag/drop controls or
perform Photoshop mutations.

- Album schema v2 adds one bounded `design` value to each Sheet.
- Existing Album schema v1 data migrates to v2 with an empty design; migration
  never invents photo assignments.
- Assignments persist only a positive Smart Object `slotLayerId`, an opaque
  `p1-…` Photo key, and a normalized `{x, y}` crop-focus point.
- Commands support assign, clear, swap/move, and crop-focus changes against
  current allowlisted slots and Photo keys.
- Sheet template changes clear assignments from the prior PSD.
- Existing Sheet move and template-selection commands cover story order and
  template choice.
- Existing bounded Album history records accepted manual edits for undo/redo.
- A changed design invalidates a previously prepared Sheet render request.

## Safety boundary

- no Photo objects, paths, filenames, entries, tokens, Photoshop documents, or
  layer objects are persisted;
- malformed schemas, duplicate slots, unknown photos/slots, invalid crop
  points, and stale render requests fail closed;
- commands are immutable and deterministic;
- persistence remains under `ProjectService` and canonical Project ownership;
- batch locking and persist-before-publish behavior remain unchanged.

## Deferred slices

- template slot discovery and a stable UI projection;
- drag/drop and keyboard assignment controls;
- visual crop-focus editing and previews;
- converting persisted manual assignments into a Photoshop execution plan;
- Photoshop/UXP qualification with disposable photos and Smart Object PSDs.

## Verification

Production bundle measurement:

| Measurement | Bytes |
| --- | ---: |
| Current `main` `dist/index.js` | 571,588 |
| ALB-081 Slice 1 `dist/index.js` | 579,856 |
| Increment | 8,268 (1.446%) |
| Slice 1 ceiling | 581,632 (568 KiB) |
| Remaining headroom | 1,776 |
| Current `main` reproducible release ZIP | 160,095 |
| ALB-081 Slice 1 reproducible release ZIP | 161,741 |
| Release ZIP increment | 1,646 (1.028%) |

- `npm run test:alb081`
- `npm test`
- `npm run architecture:verify`
- `npm run regression:verify`
- `npm run build:prod`
- `npm run package:verify`
- `git diff --check`
