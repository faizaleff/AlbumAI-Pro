# ALB-123 — Quote and Caption Placement

## Outcome

ALB-123 adds explicit placement choices to the existing Typography panel for
template text layers: Keep position, Top left/center/right, and Bottom
left/center/right. These choices support Caption and Quote roles without
inferring intent from layer names or role labels.

## Placement contract

- Keep position remains the default and emits no placement instruction.
- A selected anchor positions the existing text layer inside a deterministic
  four-percent document inset, with a minimum 24-pixel inset.
- The target is calculated from the live post-text/post-style layer bounds so
  the selected edge or centre remains accurate after content changes.
- ALB-118 validates the explicit placement anchor before Photoshop mutation.
- ALB-119 uses the Photoshop UXP `Layer.translate()` API with explicit
  `pixelsUnit` values inside the existing suspended-history transaction and
  requires its awaited host operation to complete successfully. Post-transform
  reads are intentionally avoided because Photoshop can invalidate the live
  text-layer DOM handle after a successful transform.
- Immediately before translation, the adapter selects and verifies the exact
  planned layer through `Document.activeLayers`; this prevents Photoshop from
  applying a transform to a previously active text layer.

## Safety boundary

The full target set, document dimensions, layer bounds, editability, and
translation capability are preflighted before mutation. Invalid or unavailable
placement fails closed. Any write or verification failure rolls back the whole
history group; one `Cmd+Z` reverts a successful multi-layer operation.

This milestone creates no new text layers, resizes no text boxes, downloads no
fonts, adds no project schema, and performs no role inference.

## Verification

The ALB-123 suite covers valid and invalid placement plans, safe default draft
conversion, deterministic six-anchor geometry, preflight rejection, rejected
translation rollback, and production-panel integration. Runtime acceptance
requires placing Caption and Quote layers at two visibly different anchors in
a disposable PSD and confirming one grouped `Cmd+Z` restores both positions.
