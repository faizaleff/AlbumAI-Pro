# ALB-122 — Template-local Typography Style Presets

## Outcome

ALB-122 lets an operator reuse typography already present in the selected template. For each editable text layer, the Typography panel offers **Preserve current style** by default and a style option for every template text layer.

Selecting a style copies only that source layer's font family, font size, colour, and alignment into an explicit text assignment. It never infers a role, changes a layer by itself, or creates a project-wide preset.

## Safety boundary

- Preserve current style sends `preset: null` and is the default.
- A style is copied only after an explicit operator selection.
- Styles are detached before entering the plan, preventing indirect mutation of the browser state or template inventory.
- The existing ALB-118 plan validates every optional style field.
- The existing ALB-119 adapter retains its single Photoshop history transaction and grouped `Cmd+Z`.
- Options are calculated from the current selected template only.

## Product boundary

This adds no network dependency, external font download, or project schema. It copies styles already available in the open Photoshop document; missing fonts remain Photoshop's normal host responsibility.

## Verification

The ALB-122 suite covers canonical reader-field compatibility, alignment normalization, detached style copies, preserve-style defaults, explicit plan assignments, successful preview refresh, and panel integration. Runtime acceptance requires applying two text layers in a disposable PSD, selecting one layer's style for the other, confirming the result, and confirming one `Cmd+Z` reverts the grouped edit.

## Runtime acceptance

Passed in Photoshop 2026 on 2026-08-26 using the disposable two-layer
`ALB-121-Typography-Test.psd` fixture. The operator assigned `Style: TITTLE`
to the Caption layer, applied both explicit assignments successfully, confirmed
the cross-layer style result, and confirmed one `Cmd+Z` reverted the grouped
operation.
