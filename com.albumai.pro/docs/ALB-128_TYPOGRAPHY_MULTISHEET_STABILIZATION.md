# ALB-128 — Typography and Multi-Sheet Stabilization

Status: delivered and runtime-qualified.

## Objective

Harden the ALB-127 sheet-owned typography workflow across multi-sheet albums,
stale requests, template edge cases, cancellation, persistence, and readable
operator feedback before the next commercial public release.

## Slice 1 — Render-request integrity

- Snapshot every typography assignment as detached, deeply frozen data.
- Revalidate exact text, role, layer, preset, color, and placement intent at the
  final render boundary.
- Reject a request as `SHEET_STALE` if typography changed after request creation.
- Preserve isolated typography intent for every sheet in a multi-sheet batch.
- Stop at the replacement boundary before Typography when cancellation arrives
  during replacement, and stop at the Typography boundary before output when
  cancellation arrives during text application.
- Preserve bounded Unicode and multiline text without normalization or loss.
- Reject duplicate layer targets, text over 2,000 UTF-16 code units, unknown
  placement anchors, and malformed or out-of-budget persisted style presets.
- Explain locked and hidden layers inline, and translate missing-layer,
  unavailable-font, placement, grouped-Undo, verification, and Photoshop
  rejection codes into actionable operator messages without exposing internals.

## Automated qualification

- ALB-128 stabilization suite: PASS.
- ALB-121 manual typography regression suite: PASS (8 tests).
- ALB-119 Photoshop adapter regression suite: PASS (9 tests).
- Production build and strict 740 KiB bundle gate: PASS (757,666 bytes).
- Generated bundle identity verification and whitespace validation: PASS.

## Runtime qualification matrix

- grouped, hidden, locked, missing-font, paragraph, multiline, Unicode, and
  long-text fixtures;
- multiple typography-enabled sheets using repeated templates;
- save/reopen, cancellation, recovery, and output-failure boundaries;
- compact user-facing diagnostics for template and typography failures; and
- Photoshop runtime evidence for the final stabilized workflow.

### Required runtime evidence

1. Use a disposable project containing at least two sheets that reuse the same
   typography-enabled PSD template.
2. Give each sheet different title/caption text; include Malayalam and a
   multiline value on one sheet.
3. Render each sheet and verify that its output contains only its own text,
   font/style, and placement choices.
4. Change typography after preparing a render and confirm the stale request is
   rejected rather than rendering old intent.
5. Verify a locked layer and hidden layer are disabled with readable guidance;
   verify a missing font fails safely without partial text edits.
6. Cancel once during photo replacement and once during Typography. Confirm no
   save/export occurs after either cancellation boundary.
7. Save and reopen the project, re-render both sheets, then verify Cmd+Z groups
   each typography application as one undo operation.
8. Capture the AlbumAI Summary, Debug Log, rendered outputs, and screenshots for
   the ALB-128 evidence packet.

### Runtime evidence — 2026-08-27

- Photoshop 27.4.0 / UXP 9.2.0; refreshed production bundle.
- Disposable fixture: `ALB-127-Storyboard-Typography-Test.psd`, document 653.
- Preflight: `READY`, two editable text layers (12 and 11).
- Applied Malayalam Unicode title plus Malayalam/English multiline caption.
- Runtime result: `SUCCESS`; completed layer IDs `[12, 11]`; no failed layer.
- One Cmd+Z restored both original layer values, confirming grouped Undo.
- Missing-font qualification failed closed with `FONT_UNAVAILABLE`, zero
  completed layers, and both original text values preserved.
- A deliberately incorrect expected document ID was blocked with
  `DOCUMENT_MISMATCH` before mutation.
- A nonexistent target layer was blocked during planning with
  `TARGET_NOT_FOUND`, before any Photoshop edit.
- A temporary native lock experiment was restored, but the inspection surface
  continued to report the layer editable; locked/hidden runtime evidence is
  therefore still pending rather than recorded as a pass.
- Remaining: repeated-template multi-sheet isolation, exact sheet stale-request
  rejection, locked/hidden diagnostics, cancellation boundaries, save/reopen,
  recovery, and output-failure evidence.

### Runtime qualification closure — 2026-08-31

- Host: Photoshop 2026 v27.4.0 / UXP 9.2.0, using the refreshed production
  bundle and disposable project `REC005-MULTI-TEMPLATE-2`.
- Reused `ALB-127-Storyboard-Typography-Test.psd` for two independent sheets.
  Sheet 5 rendered `ALB-128 Sheet 5 Title` plus the exact Malayalam caption
  `ALB-128 ഷീറ്റ് 5 മലയാളം ക്യാപ്ഷൻ`. Sheet 6 rendered `ALB-128 Sheet 6 Title`
  plus the multiline caption `ALB-128 Sheet 6 Caption\nSecond line`.
- Each rendered sheet contained only its own typography. Sheet 6 used
  `TOP_CENTER` and `BOTTOM_CENTER`; no Sheet 5 text leaked into it. A preserved
  font without full Malayalam coverage displayed a missing-glyph box, while
  runtime inspection confirmed that the underlying Unicode text was exact.
- One Cmd+Z restored both typography layers together. Closing and reopening the
  project preserved both sheets' assignments, and both sheets re-rendered with
  their original isolated intent.
- A request whose sheet typography changed after snapshot was rejected with
  `SHEET_STALE` before Photoshop opened, output began, or project state mutated.
- Native hidden and locked text-layer cases were rejected before mutation with
  `PLAN_BLOCKED` / `TARGET_NOT_EDITABLE` and readable operator guidance. The
  missing-font case failed closed with `FONT_UNAVAILABLE`, zero completed
  layers, and original text preserved.
- Replacement-stage cancellation used batch
  `6e0c8d03-fa45-42c0-ba9e-28eef9b43f46`; lifecycle was `CANCELLED`, no output
  committed, and selected photos were not consumed. A bounded real-workflow
  Typography-stage probe also completed `CANCELLED` at `TYPOGRAPHY` with both
  Auto Save and Export enabled for the probe and no output attempt.
- A real filesystem export failure used batch
  `ea8510bc-f06f-4b3b-a0c9-7900e4b5de05`. The batch stopped at 100% with
  `COMPLETED_WITH_ERRORS`, one failed sheet, `Template export failed.`, no
  selected-photo consumption, and no final `Spread_05.jpg`. Cleanup was also
  denied by the same read-only fixture, so recovery correctly classified the
  output as `REMEDIATION_REQUIRED` / `CLEANUP_FAILED` rather than safe retry.
  The fixture permission was restored immediately after the test.
- Final AlbumAI Summary and Debug Log reported 1/1 completed, 0 successful,
  1 failed, Auto Save `SKIPPED`, Export `FAILED`, 100% progress, zero committed
  or safe-retry outputs, one cleanup-required output, and one remediation
  template. No batch fatal error was reported.

### Evidence packet

- Multi-sheet rendering: `docs/evidence/alb-128/sheet-5-runtime.png` and
  `docs/evidence/alb-128/sheet-6-runtime.png`.
- Grouped Undo and persistence: `docs/evidence/alb-128/sheet-6-grouped-undo.png`,
  `docs/evidence/alb-128/sheet-5-after-reopen.png`, and
  `docs/evidence/alb-128/sheet-6-after-reopen.png`.
- Stale request: `docs/evidence/alb-128/stale-request-runtime.png`.
- Locked-layer result and guidance:
  `docs/evidence/alb-128/locked-layer-runtime.png` and
  `docs/evidence/alb-128/locked-layer-guidance.png`.
- Typography cancellation:
  `docs/evidence/alb-128/typography-cancellation-runtime.png`.
- Output failure and host state:
  `docs/evidence/alb-128/output-failure-runtime.png` and
  `docs/evidence/alb-128/output-failure-photoshop.png`.
- Final operator diagnostics: `docs/evidence/alb-128/albumai-summary.txt` and
  `docs/evidence/alb-128/albumai-debug-log.txt`.

All temporary runtime hooks used for bounded qualification were removed before
the final production build. No qualification-only hook remains in source or in
the verified bundle.
