# ALB-119 — Photoshop Typography Adapter

## Status

Engineering adapter implemented. Automated verification is required and
Photoshop runtime qualification remains pending. This is not a shipped product
claim and introduces no UI.

## Root cause

ALB-118 can inventory text layers and produce a deterministic READY typography
plan, but the active architecture had no fail-closed Photoshop boundary for
applying that plan. Direct execution without a dedicated boundary could target
the wrong document or layer, partially mutate a multi-layer plan, use an
unavailable font, or report success without verifying Photoshop state.

## Minimal implementation

`PhotoshopTypographyAdapter` accepts only a READY immutable plan and:

- activates and validates the exact expected document;
- preflights every exact text-layer target before any mutation;
- requires every target to remain editable and every requested font to be
  available by exact PostScript name;
- performs all layer updates inside one Photoshop modal history transaction;
- targets layers by exact numeric layer ID;
- writes through Photoshop's supported live `Layer.textItem` DOM boundary;
- verifies the written text after every update;
- commits one undo step only after all steps verify; and
- rolls back the complete history transaction on the first rejection or
  verification mismatch.

No automatic text generation, local suggestions, role inference, UI, or
background execution is included.

## Automated regression coverage

ALB-119 covers:

1. blocked-plan rejection before Photoshop access;
2. whole-plan exact-target preflight before mutation;
3. unavailable-font rejection;
4. two-layer execution in one committed undo transaction;
5. complete rollback when the second layer fails;
6. fail-closed behavior when grouped history is unavailable; and
7. rollback after a post-write verification mismatch; and
8. original-error preservation if Photoshop also rejects rollback.

## Photoshop runtime qualification

Use a disposable PSD with two editable text layers and a locally installed font.

1. Generate an ALB-118 READY plan for both exact text-layer IDs.
2. Execute it through the ALB-119 adapter.
3. Confirm both text values and preset attributes changed on the intended
   document only.
4. Press Undo once and confirm both changes are reverted together.
5. Repeat with an unavailable PostScript font name and confirm no layer changes.
6. Repeat with the second target invalidated after planning and confirm the
   entire operation fails before mutation or rolls back without a partial edit.

Runtime qualification must be recorded before this adapter is connected to a
user-facing typography action.
