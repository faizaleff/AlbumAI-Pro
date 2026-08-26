# ALB-127 — Storyboard Typography Assignment

## Outcome

ALB-127 binds explicit Title, Caption, and Quote assignments to one canonical
album sheet. A successful manual Typography application records the exact
layer IDs, text, optional preset, and placement on the selected sheet when the
open PSD matches that sheet's registered template.

During **Render Spread** and full album processing, the detached render request
snapshots those assignments. Photoshop applies them to the exact opened
template after photo replacement and before Save/Export.

## Safety contract

- Assignments belong to one sheet and are copied only by an explicit sheet
  duplication.
- A mismatched open PSD is never attached to the selected sheet.
- Persisted assignments contain no Photoshop host objects or native paths.
- Render-request revalidation detects stale sheet or registry state before
  execution.
- Typography failure fails the sheet before Save/Export; partial output is not
  reported as success.
- Existing exact-document checks, whole-plan preflight, grouped Undo, rollback,
  and post-write verification remain authoritative.

## Verification

The ALB-127 suite covers immutable sheet persistence, save/reopen
normalization, detached render-request snapshots, invalid-role rejection, and
the required Typography-before-output execution order. Existing ALB-080 and
ALB-091 album-domain/render bridge suites and the production webpack build also
pass.

## Runtime qualification

Runtime-qualified in Photoshop 2026 v27.4.0 / UXP 9.2.0 on 2026-08-26 with
`ALB-127-Storyboard-Typography-Test.psd`:

- registered a disposable fixture containing two Smart Object photo slots and
  two editable text layers;
- assigned both photo slots on one explicit storyboard sheet;
- applied and persisted `ALB-127 Runtime Title` and
  `ALB-127 Runtime Caption` for that sheet;
- verified grouped Photoshop Undo restored the original text while preserving
  the sheet's saved typography intent;
- rendered the sheet and observed two successful Smart Object replacements;
- observed the exact active document immediately before Typography, followed
  by a successful grouped `Apply Album Typography` modal operation;
- verified Typography completed before Save and Export stages; and
- visually confirmed the rendered spread contained both replaced photos and
  both persisted text assignments, with the batch completing `1/1` and zero
  failures.
