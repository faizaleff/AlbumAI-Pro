# Brush-shaped Smart Object slots — 2026-09-20

The `01.psd` template contained brush transparency inside a Smart Object, with no external pixel mask. Replace Contents removed that transparency, and the previous fallback generated a rectangular mask.

## Changes

- Capture template transparency into an unlinked pixel mask before replacing contents when no pixel mask exists. Retain existing pixel/vector masks and layer effects.
- Measure replacement content using the Smart Object transform quad instead of masked layer bounds; pan/zoom operates underneath the fixed mask.
- Cache a bounded-session draft cover containing the brush alpha and template background, with foreground text/decorations above the photo. Draft gestures do not invoke Photoshop rendering.
- Keep layer fill/effects and visibility restored even if preview capture fails. Release cached cover URLs on eviction/clear.
- Respect mirrored Smart Object orientation in the draft photo.

## Verification

- ALB-081: 177 assertions passed.
- ALB-083: 243 assertions passed, including fractional alpha, trimmed mask coordinates, foreground text, existing mask preservation, transform bounds, and preview failure cleanup.
- Production build passed (790 KiB ceiling; bundle approximately 787 KiB).
- Installed and restarted Photoshop 2026.
- Live check: `Spread_07` / `Templates/01.psd` in the disposable ALB045 test album. Render preserved the brush edge; draft zoom 150→160%, drag, and Apply retained the edge and template text. Replacement with `11.jpg` and empty-slot draft also retained the outline. Test draft discarded and applied positioning undone, returning to `10.jpg` at 150%.
- Source PSD was not saved/overwritten.

## Remaining coverage limits

The live fixture has brush alpha and text; dedicated soft-shadow, vector+pixel-mask combinations and non-Normal blend-mode templates have not been visually verified. Draft foreground composition assumes normal alpha compositing. A Smart Object containing both internal brush alpha and an existing user mask retains that user mask but does not yet combine internal alpha into it. These cases must not be described as universally verified.
