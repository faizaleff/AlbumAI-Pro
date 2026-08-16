# ALB-081 — Manual Designer Workflow, Slice 2

Status: **IMPLEMENTED — DESIGNER UI FOUNDATION**

Baseline: **Slice 1 on `agent/alb-081-manual-designer-slice-1`**

## Scope

Slice 2 exposes the Slice 1 contract through a bounded Photoshop UXP panel.
It provides inspection and selection states only; photo assignment interactions
remain deferred.

- The selected Album Sheet opens a Manual Designer panel.
- The Sheet template can be changed to another registered project template;
  the existing domain command clears assignments from the prior PSD.
- A READY registered PSD can be loaded explicitly for read-only Smart Object
  slot inspection.
- Usable Smart Object slots show deterministic empty, assigned, and missing
  Photo states.
- A thumbnail Photo tray shows at most 120 items and reports the total/hidden
  counts for large libraries.
- The panel distinguishes no selection, missing template, unloaded template,
  no usable slots, and ready states.
- Compact-panel wrapping and scroll limits keep the controls reachable.

## Safety and ownership

- the detached UI view contains only bounded labels, opaque Photo keys, layer
  ids, normalized bounds, crop focus, and assignment status;
- source paths, UXP entries, Photo objects, Photoshop documents, and layer
  objects never enter persisted design state or the view model;
- template loading is explicit, validates the registered descriptor first,
  and uses the existing single-owned-document reader lifecycle;
- the active PSD carries its registered project-template id only in memory so
  slot data cannot be shown for the wrong Sheet template;
- the Photo tray is capped at 120 rendered items and does not introduce a
  second Photo collection owner.

## Deferred slices

- drag/drop, click, and keyboard photo assignment;
- slot clear, replace, and swap controls;
- crop-focus controls and visual crop preview;
- translating the persisted design to a Photoshop execution plan;
- Photoshop/UXP runtime qualification with disposable fixtures.

## Verification

Production bundle measurement:

| Measurement | Bytes |
| --- | ---: |
| Slice 1 `dist/index.js` | 579,856 |
| ALB-081 Slice 2 `dist/index.js` | 590,867 |
| Slice 2 increment | 11,011 (1.899%) |
| Combined increment from `main` | 19,279 (3.373%) |
| Slice 2 ceiling | 593,920 (580 KiB) |
| Remaining headroom | 3,053 |
| Slice 1 reproducible release ZIP | 161,741 |
| ALB-081 Slice 2 reproducible release ZIP | 164,575 |
| Slice 2 release ZIP increment | 2,834 (1.752%) |

- `npm run test:alb081`: 20 focused assertions
- `npm run architecture:verify`: 105 reachable source files
- `npm run regression:verify`: 105/105 active files reached
- `npm test`
- `npm run hardening:verify`
- `npm run build:prod`
- `npm run package:verify`
- `git diff --check`
