# ALB-124 — Font and Style Presets

## Outcome

ALB-124 separates template-local typography reuse into two explicit choices:
an exact font preset and a non-font style preset. An operator can combine the
font already present on one template text layer with the size, color, and
alignment already present on another layer.

## Preset contract

- Preserve current font and Preserve current style remain the safe defaults.
- Font choices contain only exact, non-empty PostScript font names already
  observed in the current template and are de-duplicated without aliases.
- Style choices contain only bounded font size, RGB color, and normalized
  alignment fields; they never change the font implicitly.
- The two explicit choices merge into the existing detached ALB-118 preset
  shape before plan validation and Photoshop execution.
- Preset objects and colors are cloned so UI drafts, template inspection data,
  plans, and document previews do not share mutable state.

## Safety boundary

This milestone downloads no fonts, guesses no font substitutions, and adds no
project schema. The ALB-119 adapter continues to require an exact installed
font match before any mutation and keeps all selected layer changes inside one
rollback-capable grouped Undo transaction.

## Verification

The ALB-124 suite covers exact font de-duplication, font-free style choices,
detached preset composition, safe defaults, completed-document preview refresh,
and production-panel integration.

Photoshop 27.4.0 runtime acceptance passed on the two-layer
`ALB-121-Typography-Test.psd` fixture. The caption layer received the title
layer's exact font and style while the title layer received the caption
layer's exact font and style. The grouped modal transaction completed without
an execution error, and one `Cmd+Z` restored both layers and cleared the
document dirty marker.
