# ALB-093 Runtime Verification

Verified: 2026-08-21 (Asia/Kolkata)

## Runtime

- Project: `REC005-MULTI-TEMPLATE-2`
- UXP manifest: `/Users/eff/Documents/AlbumAI/com.albumai.pro/dist/manifest.json`
- Workflow: full Lab Print A-B-A-B album batch
- Template order: `01.psd`, `02.psd`, `01.psd`, `02.psd`

## Execution evidence

| Spread | Template | Assignments | Plan steps | Successful replacements | Export |
| --- | --- | ---: | ---: | --- | --- |
| 01 | 01.psd | 2 | 2 | layer 4 and layer 2 — `ZSA00166.jpg` | committed |
| 02 | 02.psd | 1 | 1 | layer 2 — `ZSA00175.jpg` | committed |
| 03 | 01.psd | 2 | 2 | layer 4 and layer 2 — `ZSA00181.jpg` | committed |
| 04 | 02.psd | 1 | 1 | layer 2 — `ZSA00187.jpg` | committed |

All four executions reported:

- `TEMPLATE_REPLACEMENT_STATUS: COMPLETED`
- `TEMPLATE_REPLACEMENT_COMPLETED: true`
- `ALB045_EXPORT_TERMINAL_COMMITTED`
- `BATCH_EXPORT_DONE: ... — SUCCESS`
- `TEMPLATE_FINAL_OUTCOME: COMPLETED`
- `BATCH_QUEUE_COMPLETE: 1/1 completed, 0 failed`

No `STEP_FAILED`, runtime error, or cancellation marker was present in the captured batch log.

## Output evidence

The project Export folder contains four JPEG outputs from the same batch run:

- `Spread_01.jpg` — 12.7 MB
- `Spread_02.jpg` — 7 MB
- `Spread_03.jpg` — 13 MB
- `Spread_04.jpg` — 6.6 MB

## Qualification result

- ALB-092 manual multi-template assignment, exact slot mapping, persistence, and single-sheet execution: **PASS**
- ALB-093 full A-B-A-B album render and transactional JPEG export: **PASS**
- Non-blocking runtime notice: UXP reports deprecated `sp-dropdown` usage. This did not affect the qualified workflow and is deferred to a separate UI-maintenance slice.
- Diagnostic debt: the source build identity still reports `ALB-030.3-scroll-commit-timing-v1`; the manifest path and bundled ALB-093 behavior were independently confirmed.
