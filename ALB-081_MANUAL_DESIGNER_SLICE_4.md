# ALB-081 — Manual Designer Workflow, Slice 4

Status: **IMPLEMENTED — CROP-FOCUS CONTROLS AND PREVIEW**

Baseline: **Slice 3 on `agent/alb-081-manual-designer-slice-1`**

## Scope

Slice 4 exposes the persisted crop-focus point for a selected assigned slot.

- horizontal and vertical range controls edit a local `{x, y}` draft;
- Center, Top, Bottom, Left, and Right presets update the draft;
- the selected Photo preview uses cover positioning and a visible focus marker;
- slot thumbnails use the persisted focus point;
- Revert restores the persisted point without creating history;
- Apply validates, normalizes, persists, and records one undoable design change;
- the selected slot stays active after a successful crop save for continued
  adjustment.

## Safety and ownership

- slider movement never writes project metadata by itself;
- only explicit Apply emits `SET_CROP_FOCUS` through the existing Sheet design
  persistence boundary;
- slot ids must be positive safe integers, while both coordinates must be
  finite and within `0…1`;
- UI commands normalize coordinates to six decimal places before persistence;
- preview rendering consumes the canonical Photo thumbnail/preview service and
  retains no additional source paths or host objects;
- crop preview is CSS positioning only and performs no Photoshop mutation.

## Deferred slices

- translating the complete persisted design into a Photoshop execution plan;
- applying assignments and crop focus to Smart Objects;
- Photoshop/UXP runtime qualification with disposable PSD and Photo fixtures;
- final interaction/accessibility hardening after runtime feedback.

## Verification

| Measurement | Bytes |
| --- | ---: |
| Slice 3 `dist/index.js` | 595,348 |
| ALB-081 Slice 4 `dist/index.js` | 601,287 |
| Slice 4 increment | 5,939 (0.998%) |
| Combined increment from `main` | 29,699 (5.196%) |
| Slice 4 ceiling | 604,160 (590 KiB) |
| Remaining headroom | 2,873 |
| Slice 3 reproducible release ZIP | 165,861 |
| ALB-081 Slice 4 reproducible release ZIP | 166,620 |
| Slice 4 release ZIP increment | 759 (0.458%) |

- `npm run test:alb081`: 28 focused assertions
- `npm test`
- `npm run architecture:verify`: 105 reachable source files
- `npm run regression:verify`: 105/105 active files reached
- `npm run hardening:verify`
- `npm run build:prod`
- `npm run package:verify`
- `git diff --check`
