# ALB-126 — Custom Project Text Presets

## Outcome

ALB-126 lets an operator save, reuse, rename, edit, and delete role-specific
Title, Caption, and Quote text presets from the existing Typography panel.
Presets are stored in the active project's `project.json` metadata and are not
shared with other projects.

## Safety contract

- Custom presets are offline project data; no network, model, or analytics call
  is made.
- A saved preset appears only for its explicit Title, Caption, or Quote role.
- Selecting a preset changes only the detached draft. Photoshop is unchanged
  until the operator chooses **Apply Typography**.
- Renaming, editing, or deleting a preset never mutates a Photoshop document.
- Existing exact-document preflight, grouped Undo, rollback, and verification
  remain the only path for applying text.
- Invalid records and duplicate names within one role fail closed.

## Verification

The ALB-126 suite covers catalog normalization, immutable create/update,
role-local duplicate protection, exact deletion, role isolation, explicit
selection, project persistence wiring, and offline boundaries.

The production bundle ceiling moves narrowly from 732 KiB to 740 KiB to
accommodate the project-preset management UI while retaining a hard growth
gate.

## Runtime qualification

Runtime-qualified in Photoshop 2026 v27.4.0 / UXP 9.2.0 on 2026-08-26:

- saved a project-local Title preset and verified it was committed to
  `project.json`;
- reloaded the plugin/project and verified `Saved: Runtime Title` remained
  available only in the Title suggestion picker;
- selected the saved preset and applied `ALB-126 Saved Title` to the intended
  Photoshop text layer;
- verified the grouped Photoshop operation completed and **Cmd+Z** restored
  the original `TITTLE` text;
- updated the saved preset and verified the project metadata changed; and
- deleted the temporary runtime preset and verified the persisted catalog was
  empty afterward.

The qualification also exposed and fixed a UXP event-lifetime defect in the
new preset input handlers. Input values are now captured synchronously before
functional state updates, preventing released React events from producing a
null `target` during real UXP input.
