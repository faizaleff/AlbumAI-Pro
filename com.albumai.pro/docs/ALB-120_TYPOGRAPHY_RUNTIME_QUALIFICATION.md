# ALB-120 — Typography Runtime Qualification

## Purpose

ALB-120 provides the bounded Photoshop runtime evidence path for the ALB-119
typography adapter. It is a developer-console diagnostic, not product UI and
not a shipped Smart Typography workflow.

The harness uses the production `TypographyPlan` and
`PhotoshopTypographyAdapter`. It does not duplicate Photoshop mutation logic.

## Runtime discovery correction

The first live inspection reported zero text layers even though the disposable
Photoshop document visibly contained two Type layers. Photoshop UXP exposes
`constants.LayerKind.TEXT` with the runtime value `"text"`, while AlbumAI's
canonical layer schema uses `"textLayer"`. The host layer scanner now
normalizes that value at the Photoshop boundary. A regression test passes two
UXP-shaped `kind: "text"` layers through the production scanner and reader and
requires a two-layer `READY` inventory.

The live mutation then failed on the first exact target even though the
two-step plan and both target IDs were valid. Normalizing the Action Manager
target from `textLayer` to generic `layer` did not change the runtime result:
Photoshop still rejected the partial `set` descriptor before either layer was
completed. The failure boundary was therefore the fragile partial Action
Manager text payload, not document activation, plan generation, or layer-ID
selection.

The adapter now uses Photoshop's supported live `Layer.textItem` DOM boundary
for content and typography properties. It mutates the already preflighted live
layer object, reads `textItem.contents` back after every write, and retains the
same exact-document checks and single grouped Undo transaction. Regression
coverage includes two-layer content and preset mutation, read-back mismatch,
first rejected layer, second rejected layer, and preservation of the original
Photoshop rejection when rollback itself also errors.

## Safety contract

- Use only a disposable copied PSD containing at least two editable text layers.
- Inspection is read-only.
- Inspection and execution block unless at least two text layers are discovered.
- Execution requires `confirmDisposableDocument: true`.
- Execution requires the exact active Photoshop document id.
- Execution accepts exactly two explicit assignments; it never infers roles.
- The harness never saves or exports the PSD.
- The adapter performs whole-plan preflight and one grouped Undo transaction.

## Runtime procedure

1. Build and reload the local `dist/manifest.json` bundle.
2. Open a disposable copied PSD and make it the active Photoshop document.
3. In the UXP developer console run:

```js
__ALBUMAI_ALB120_INSPECT_TYPOGRAPHY__()
```

4. Record the returned `documentId` and choose two returned editable
   `layerId` values.
5. Run the qualification with those exact ids:

```js
__ALBUMAI_ALB120_QUALIFY_TYPOGRAPHY__({
  confirmDisposableDocument: true,
  expectedDocumentId: 123,
  templateId: "ALB-120-disposable-fixture",
  assignments: [
    { layerId: 7, role: "TITLE", text: "ALB-120 Runtime Title", preset: null },
    { layerId: 8, role: "CAPTION", text: "ALB-120 Runtime Caption", preset: null }
  ]
})
```

6. Confirm the console marker
   `ALB_120_TYPOGRAPHY_RUNTIME_QUALIFICATION` reports `SUCCESS`, two plan
   steps, and both completed layer ids.
7. Confirm both Photoshop text layers changed.
8. Press Undo once and confirm both changes revert together.
9. Repeat with an unavailable exact PostScript font in one preset and confirm
   `FAILED / FONT_UNAVAILABLE` with neither layer changed.
10. Lock or remove the second disposable target before execution and confirm
    the run is blocked or failed before any partial committed change.

## Pass criteria

- Inspection reports the active document and exact text-layer identities.
- A document with fewer than two discovered text layers reports
  `BLOCKED / INSUFFICIENT_TEXT_LAYERS`.
- The successful plan contains exactly two steps.
- Both exact targets update and verify.
- One Undo reverts both changes.
- Font and invalid-target failures do not leave a partial committed result.
- No PSD or export file is written by the harness.

## Recorded runtime evidence

Qualified in Photoshop 2026 on 2026-08-25 using disposable document `192`:

- Inspection: `READY`, with two editable text layers (`2`, `3`).
- Plan: exactly two steps targeting layers `[2, 3]`.
- Execution: `SUCCESS`, with `completedLayerIds: [2, 3]` and no failed layer.
- Visual verification: both title and caption changed to the requested text.
- Undo verification: one `Cmd + Z` reverted both changes together.
- Output safety: the qualification harness did not save or export the PSD.

The successful runtime mutation and grouped-Undo path are qualified. Negative
font, missing-target, verification, and rollback paths remain enforced by the
automated ALB-119/ALB-120 regression suites. Product UI integration remains
out of scope.
