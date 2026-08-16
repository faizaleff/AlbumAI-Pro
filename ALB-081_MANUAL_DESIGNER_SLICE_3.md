# ALB-081 — Manual Designer Workflow, Slice 3

Status: **IMPLEMENTED — MANUAL ASSIGNMENT INTERACTIONS**

Baseline: **Slice 2 on `agent/alb-081-manual-designer-slice-1`**

## Scope

Slice 3 connects the Slice 2 panel to the persisted Slice 1 command contract.

- selecting a Photo and then a slot assigns or replaces that slot;
- dragging a Photo onto a slot performs the same bounded assignment command;
- selecting two slots, or dragging one assigned slot onto another, swaps their
  assignments and crop-focus values;
- moving an assigned slot onto an empty slot preserves the assignment;
- a clear button or Delete/Backspace removes the focused slot assignment;
- Escape cancels the current Photo/slot selection;
- existing Album Undo/Redo controls restore every persisted design change;
- selection, in-flight, failure, and disabled states are visible and block
  duplicate mutation requests.

## Safety and ownership

- drag payloads stay in component memory; no path, UXP token, filename, or host
  object is placed on the platform drag data transfer;
- malformed Photo keys, invalid slots, and self-drops are rejected before
  persistence;
- `AppController` derives slot allowlists only from the active inspected PSD
  matching the Sheet's registered template id;
- Photo allowlists are derived from current canonical Photo workspace entries
  and converted to opaque `p1-…` keys;
- `ProjectService` remains the persist-before-publish boundary, and stale Album
  cursors or concurrent batch mutations continue to fail closed;
- local busy refs prevent same-frame duplicate template/design requests.

## Deferred slices

- crop-focus controls and crop preview;
- translating persisted assignments into a Photoshop execution plan;
- applying manual design mutations to Smart Objects;
- Photoshop/UXP runtime qualification for pointer, drag/drop, keyboard, and
  disposable PSD/Photo fixtures.

## Verification

| Measurement | Bytes |
| --- | ---: |
| Slice 2 `dist/index.js` | 590,867 |
| ALB-081 Slice 3 `dist/index.js` | 595,348 |
| Slice 3 increment | 4,481 (0.758%) |
| Combined increment from `main` | 23,760 (4.157%) |
| Slice 3 ceiling | 598,016 (584 KiB) |
| Remaining headroom | 2,668 |
| Slice 2 reproducible release ZIP | 164,575 |
| ALB-081 Slice 3 reproducible release ZIP | 165,861 |
| Slice 3 release ZIP increment | 1,286 (0.781%) |

- `npm run test:alb081`: 25 focused assertions
- `npm test`
- `npm run architecture:verify`: 105 reachable source files
- `npm run regression:verify`: 105/105 active files reached
- `npm run hardening:verify`
- `npm run build:prod`
- `npm run package:verify`
- `git diff --check`
