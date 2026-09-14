# Library preview consistency — 2026-09-10

## Delivery 1: implemented, runtime acceptance pending

- Normal Preview defaults to Pan, matching Burst Review.
- Both use the same reviewZoomStep helper: buttons change Fit-relative scale by
  0.25, wheel by 0.12, bounded to 0.25–4.
- Horizontal-only wheel input does not navigate images or change zoom.
- Double-click returns to Fit. The normal preview's optional Zoom tool retains
  pointer-anchored drag zoom and click levels; default Pan does not click-zoom.
- Existing shared geometry/pan bounds, image-quality tiers and decision
  persistence are retained. The two shells are not yet one implementation.
- Pinch is deferred, not an acceptance requirement.

## Owner test, after reload

Use an ordinary photo and an unreviewed burst; do not Apply unless intentionally
testing decisions in the disposable project.

1. Wheel up/down, then + and − in each preview: zoom without changing photo.
2. Drag the zoomed image to each edge: bounded pan, no flicker.
3. Double-click: centered Fit. Click a different frame: Fit reset.
4. Normal preview: Space/Escape closes after zoom, pan and navigation.
5. Burst without a clear score: no automatic pick; Not picked is a draft label.

Record pass/fail per item and the affected preview. Do not infer a complete
runtime pass from automated tests.

## Verification

Production build, test:alb137 (including shared zoom boundary/consumer checks),
bundle verification and git diff --check passed. Bundle 757227 bytes.
Initial Photoshop inspection timed out. After the owner's ready confirmation,
UXP Developer Tools reported Plugin Reload Successful; the existing disposable
ALB045-RT01-Project was reopened and Library focus restored. Owner interaction
acceptance remains pending; reload success is not a runtime test pass.

## Next bounded work

### Pointer-anchored wheel follow-up

Owner confirmed the interaction pass working, then requested pointer-centered
wheel zoom in both previews. Both now use reviewPointer and zoomPreviewAt:
the image point under the cursor is retained subject to frame/pan bounds.
Buttons remain center-anchored; Fit centers the image. Build and geometry tests
pass. Reload succeeded in UXP Developer Tools; ALB045-RT01-Project reopened
with 72 photos and Library focus restored. Owner pointer-anchor verification
remains pending; reload success is not physical-interaction acceptance.

Owner subsequently confirmed pointer zoom working in both previews.

### Shared rendering pass (reloaded; awaiting owner test)

Normal and Burst now use `useReviewRendering`: HD initial profile, density-aware
400ms-debounced upgrades, no zoom-out downgrade, foreground decode retention,
background-refinement pause, departed-photo cancellation, and bounded-cache
cleanup on close. Burst image is keyed by photo ID so an old frame cannot remain
as the next frame's placeholder. Cached preview/thumbnail remains the initial
fallback. This does not change the decoder or establish faster cold JPEG loads.

Hook lifecycle tests cover rapid zoom coalescing, no downgrade, next-photo reset,
resource cleanup and inactive/closed state. Library suite and production build
pass; bundle 757487 bytes, SHA256
`95ad8c097d074991cab46a0b840683d7b28a66c11a1a55f1d6a5a3a929680e41`.
UXP reported Plugin Reload Successful; the existing 72-photo test project
reopened and Library focus was restored. Physical timing and quality acceptance
remain pending. Compare cold Fit,
warm zoom, Fit again, next/back and close in both review surfaces.

### Navigation / quality-swap follow-up

Owner reported Burst navigation failure and a brief quality-swap flicker in both
surfaces. Burst now focuses a focusable dialog on open and restores focus after
pointer actions, bypasses background editable filtering while modal, handles
all arrow directions, and stops propagation to avoid duplicate frame actions.
PhotoImage now preserves the loaded pending DOM image by source key when
promoting it, instead of removing it and changing the visible image's source.
Refinement debounce is 200ms; preview request delay 80ms (previously 400/200).
Cold decode latency remains; no speed/visual acceptance is claimed yet.

Library suite, production build, bundle verification and diff checks passed.
Bundle 757649 bytes; SHA256
`27388964f7dc35767b4e7526487e31e314d9837851c46b8676c96b3718512072`.
Reload succeeded and test library was restored. Owner to check Burst arrows
after zoom/button clicks, Next/Previous, and quality transitions in both viewers.

### 4x / scroll / score follow-up (awaiting reload)

Normal preview label uses Fit-relative multiples instead of native-pixel percent.
All Normal zoom entry paths clamp to 4x, matching Burst's existing wheel/buttons.
Burst captures sidebar scroll before hiding native overflow and restores on close.
Owner must verify Escape and scroll retention in Photoshop.

Grouping no longer substitutes star ratings for analysis scores. Auto-suggestion
requires finite scores for every frame and a unique positive winner. Existing
saved picks remain untouched. This is a safeguard, not a new best-frame model:
available quality signals are sharpness/exposure/contrast, not a validated
eyes/expression/aesthetic best-of-burst assessment. That evaluation remains work.

Library tests, build, bundle and diff checks pass. Bundle 757736 bytes;
SHA256 `93a609f21c39380b1c5e382f0cbd4e43cec6d99577f948dc1b5c6f0fa40e26d8`.
Reload action completed, AlbumAI restarted and the existing test project opened;
Library keyboard focus restored. Owner verification is pending.

### Camera metadata fix (awaiting reload)

Extraction previously copied only dimensions/orientation/date and dropped parsed
camera facts. Now inspected facts reach the photo model and camera make/model/
serial are written to metadata cache. Legacy metadataLoaded photos without the
cameraMetadataLoaded marker are re-inspected. EXIF BodySerialNumber (0xA431) is
read; camera keys use make/model plus serial when present. Missing facts are
labelled Unknown camera, not Primary Camera. No serial means same-model bodies
cannot reliably be separated. Source files are never modified.

Metadata tests (10), Library tests (43), build, bundle and diff checks pass.
Tests cover serial parsing, legacy re-extraction, persistence, distinct bodies
and normalized make/model grouping. Bundle 757738 bytes, SHA256
`250e528e121785565ee0c9e4bfc41dbbb8955cc2ccd047ca57663f61060d7f27`.
Reloaded and restored the owner's 72-photo test library. After the metadata
pass the live sidebar shows C1 SONY ILCE-7M3: 3, C2 SONY ILCE-7RM5: 69,
with no remaining Unknown group. Initial Unknown 72 was transitional.

Next: measure cold-load and metadata delay, and finish the Library
acceptance checklist before Sequence. Keep commit/push as an intentional
checkpoint after review of the existing mixed working-tree changes; the user
has authorized appropriate commits/pushes, not publication of private fixtures.
