# ALB-121 — Manual Smart Typography

## Outcome

ALB-121 exposes the runtime-qualified typography foundation through the
existing Template panel. An operator can choose an explicit semantic role for
an editable Photoshop text layer, change its text, and apply the selected
changes to the exact open PSD.

## Safety boundary

- Layer roles are always chosen by the operator; names are never used to infer
  intent.
- The current template document id must match the requested Photoshop document
  id before planning or mutation.
- The detached ALB-118 plan validates every layer id, role, and text value.
- `preset: null` preserves each layer's existing Photoshop typography style.
- ALB-119 applies all selected text changes in one suspended-history
  transaction, so one Photoshop Undo reverts the operation.
- Missing, hidden, locked, stale, or mismatched targets fail closed.

## Product boundary

This milestone adds no project schema and no network dependency. Applied text
is a Photoshop document edit. Saving the PSD uses Photoshop's normal document
save behavior; unsaved form drafts are intentionally not project-persistent.

## Verification

The ALB-121 regression suite covers deterministic planning, exact-document
blocking, missing and locked targets, adapter failures, explicit role draft
conversion, style-preserving assignments, and successful preview refresh.
Runtime acceptance requires applying two text layers in an open disposable PSD,
confirming their existing styles remain intact, and confirming one `Cmd+Z`
reverts both changes.
