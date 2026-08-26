# ALB-125 — Local Text Suggestions

## Outcome

ALB-125 adds a small offline suggestion catalog to the existing manual
Typography panel. Suggestions are grouped by the explicit Title, Caption, or
Quote role and replace draft text only after an operator chooses one.

## Safety contract

- No suggestion is the default and preserves the current text.
- Choosing or changing a role never changes the text automatically.
- Suggestions are static local strings; no network, model, or analytics call is
  made.
- A suggestion remains ordinary editable draft text after selection.
- Only the existing exact-document typography plan and grouped Photoshop Undo
  transaction may commit the edited text.

## Verification

The ALB-125 suite covers role isolation, safe defaults, explicit replacement,
manual edit compatibility, assignment output, and production-panel wiring.

Photoshop 27.4.0 runtime acceptance passed on the two-layer
`ALB-121-Typography-Test.psd` fixture. The product UI applied the local Caption
suggestion `A moment to remember` and Title suggestion `Our Story` in one
successful modal transaction. One `Cmd+Z` restored both original strings, as
confirmed by a fresh exact-layer typography inspection.
