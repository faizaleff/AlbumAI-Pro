# ALB-081 — Manual Designer Workflow, Slice 5

Status: **IMPLEMENTED — RUNTIME-QUALIFIED GUARDED PHOTOSHOP EXECUTION PLAN**

Baseline: **Slice 4 on `agent/alb-081-manual-designer-slice-1`**

## Scope

Slice 5 translates a persisted Sheet design into the existing Smart Object
replacement pipeline.

- a manual render derives deterministic replacement steps in ascending
  Smart Object layer-id order;
- the plan resolves each persisted opaque Photo key against the current
  published Photo collection;
- it requires the opened PSD to retain the registered template identity and
  each referenced Smart Object slot;
- persisted crop focus reaches the replacement step and determines the fill
  crop offset;
- a manual design with assignments can render without a current browser
  selection;
- replacement, save, export, cancellation, and document cleanup remain owned
  by the existing project execution pipeline.

## Safety and ownership

- unresolved Photo keys, missing Smart Object slots, and template mismatches
  fail before any replacement command is dispatched;
- the runtime plan contains a serializable file-reference comparison value,
  never a persisted host file entry or Photoshop document object;
- crop offsets are clamped so a `fill` replacement continues covering the
  original Smart Object bounds;
- manual assignment order never consumes or reorders the selected-photo batch
  cursor;
- all Photoshop writes continue through the existing modal Smart Object and
  transform adapters.

## Deferred qualification

- Stale Smart Object slot rejection smoke test using only the disposable
  copied fixture.
- Fresh manual Sheet retry smoke test after a recoverable stale-Photo failure.

## Runtime evidence

The Photoshop UXP smoke run used the disposable `Manual-Smoke` project with
one copied PSD (`Smoke test-1.psd`), three copied JPEGs, and two inspected
Smart Object slots (`Hero` and `Detail`). The saved Sheet design assigned both
slots, persisted Detail crop focus at `{ x: 1, y: 0.5 }`, then rendered after
the browser selection was cleared. The `ALBUM_SHEET_RENDER` batch completed
one template with two replacement steps, zero failures, a committed Save Copy,
and a committed JPEG export. This confirms that execution resolves saved
manual assignments independently of live browser selection and uses the
existing output pipeline.

A stale-Photo run failed before a replacement plan, Photoshop write, Auto
Save, or Export was dispatched. Its recovery output was classified as safe to
retry. After repairing the saved Sheet assignments, the successful render
completed with `Hero` assigned to `03.jpg` and `Detail` assigned to `01.jpg`.
Closing and reopening the project, refreshing its Photo source, and reopening
the registered PSD restored the Sheet with both saved assignments (`2/2`).

## Verification

| Measurement | Bytes |
| --- | ---: |
| Slice 4 `dist/index.js` | 601,287 |
| ALB-081 Slice 5 `dist/index.js` | 605,718 |
| Slice 5 increment | 4,431 (0.737%) |
| Combined increment from `main` | 34,130 (5.970%) |
| Slice 5 ceiling | 606,208 (592 KiB) |
| Remaining headroom | 490 |
| Slice 4 reproducible release ZIP | 166,620 |
| Slice 5 reproducible release ZIP | 167,991 |
| Slice 5 release ZIP increment | 1,371 (0.823%) |

- `npm run test:alb081`: 35 focused assertions
- `npm test`
- `npm run architecture:verify`
- `npm run regression:verify`
- `npm run hardening:verify`
- `npm run build:prod`
- `npm run package:verify`
- `git diff --check`
