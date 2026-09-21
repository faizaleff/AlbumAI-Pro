# Library image quality and latency

Latest continuation: the prior task's final failed request was event/photo drag
feedback, implemented in the current branch. See
[event management continuation](event-management-2026-09-10.md#continuation-event-and-photo-drag-feedback)
for the exact request, current build/tests, and remaining native acceptance.
The preview-rendering findings below remain reference material.

## Findings

- The library thumbnail was only 200px on its longest edge, also used by the right-hand inspector. It was visibly enlarged on high-density displays.
- Every new preview/zoom profile read the source again, decoded entropy and DCT data again, resampled, synchronously JPEG-encoded, then asked the host to decode that generated JPEG.
- The prior decoder reduced RGB output but did not reduce entropy/IDCT work. Lowering JPEG quality cannot fix that bottleneck.
- Requests for images no longer mounted could remain ahead of useful work. Fit and sidebar used separate cache identities.

## Display policy implemented

| Surface | Longest-edge raster policy | Reuse / output |
| --- | --- | --- |
| Grid, list, filmstrip | Embedded draft up to 160px first, then up to 512px refinement; never upscale source; 2x sampling before bilinear reduction for small images | Shared profiles; mounted items only; drafts run before expensive refinements |
| Right inspector | Up to 1536px, starts with cached thumbnail; 180ms navigation debounce | Same cache identity as review-1536 |
| Popup fit | 1536px first, upgrade using stage dimensions and display density (capped at 2x) | Cached sidebar/thumbnail shown while upgrading |
| Zoom | 1536 / 3072 / 6144 / 12288 tiers, capped to the original; no premature rounding to native size | 400ms refinement debounce; existing raster remains displayed |
| Zoom-out | Keep the highest requested raster during the current photo session | No new lower-resolution render |

These are AlbumAI policy choices, not Adobe-mandated pixel sizes. Display output
uses native UXP ImageBlob RGBA when available, and a lossless PNG fallback. There
is no additional JPEG compression percentage or lossy JPEG recompression step.

The embedded draft is a temporary first paint, not the final quality target.
Files without a usable embedded JPEG skip that phase and still receive normal
full-source refinement. Missing drafts are negatively cached separately from
the final thumbnail. Draft and all preview tiers are invalidated with the photo.
Already displayed pixels remain in place until the replacement image loads.
The input file still needs to be read; this is not a partial-file I/O decoder.
While the popup is open, expensive background 512px refinements are paused;
foreground preview/zoom and cheap embedded filmstrip drafts remain eligible.
Existing cached 512px filmstrip images stay in use. Closing resumes queued
refinements without dropping their promises. An already running decode is
allowed to finish safely, so the first preview may still wait for that job.

The popup now measures the actual UXP body rectangle rather than relying on
`window.innerWidth/innerHeight`, which are absent in this host. It reserves
48px total outer space, caps at 1120x720, and observes panel-size changes with
a cleaned-up timer. Photo orientation and dimensions do not resize the popup.

## Memory and lifecycle

- One recent foreground source read, at most 64 MiB, expires after 30 seconds.
- One foreground decoded component-plane cache, at most 192 MiB. The visible
  popup retains this one cache; the 30-second idle expiry starts after the last
  popup viewer closes. Sidebar-only decoding still has a 30-second idle expiry.
  Zoom reuses these planes rather than repeating entropy/IDCT work.
  Native testing showed the 96 MiB cap excluded the test library's 50MP 4:4:4
  JPEG (150,543,360 bytes of planes), defeating zoom reuse. Only this one current
  photo is retained; this is not a per-photo allowance for the whole library.
  A different foreground photo replaces it, and workspace teardown clears it
  even if a viewer is still mounted. The lease release is idempotent.
- Image URL cache: 250 entries AND 96 MiB decoded-pixel estimate. This estimate
  is not total process/host memory. A single currently viewed native-size image
  may exceed it; active consumers retain ownership until replacement/unmount.
- Review/inspector subset retains its existing 32 MiB / 8-entry policy. Large
  original previews are discarded at preview close; small recent entries remain.
- Mounted consumers share request ownership. Only the last departing consumer
  cancels its request. Workspace teardown cancels work and clears retained input
  and decoder caches. URLs remain reference-counted and are revoked when unowned.
- No source photos are changed, uploaded, or opened as Photoshop documents by
  this browser rendering path. No new manifest permissions are requested.

## Adobe guidance checked

1. [Imaging API performance](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/imaging): use the smallest necessary target size; dispose PhotoshopImageData promptly. getPixels operates on **Photoshop documents**, not arbitrary unopened File entries. Opening every library photo just to obtain a thumbnail would violate the existing browser's no-document-opening invariant.
2. [UXP ImageBlob](https://developer.adobe.com/photoshop/uxp/2022/uxp-api/reference-js/global-members/image-blob/image-blob): Photoshop supports compressed and uncompressed image data as image-element URLs; revoke URLs when no longer used. The native output path follows the documented uncompressed RGBA contract and feature-detects support. In Photoshop 27.4 the constructor rejects a bare ArrayBuffer but accepts Uint8Array, matching Adobe's examples rather than its parameter table. The implementation now passes the typed view, preserving its offset and length.

This is a technical-guidance review, not a claim of Adobe certification or an
exhaustive legal/commercial terms audit.

## Verification and limits

- Synthetic 1600x1200 JPEG run: cold component decode + 400px output 88ms;
  cached-plane 800px zoom 8ms. Checkpoints fell from 1155 to 39. These are
  Node-only diagnostics, **not Photoshop performance measurements or guarantees**.
- Tests compare warm/cold pixels exactly, validate baseline/progressive RGB,
  grayscale/CMYK decoding, cancellation, memory checks, lossless PNG inflation,
  ImageBlob arguments, retained-read revision invalidation, request sharing,
  byte-budget eviction, geometry, selection and popup lifecycle contracts.
- Native visual/physical-input validation remains required: cold folder thumbnails, sidebar,
  Space/double-click, fit to 25/50/100%, zoom-out, rapid navigation, filmstrip,
  close/reopen and workspace switch. Path-free render timings are available in
  `__ALBUMAI_IMAGE_METRICS__()` and `[Preview pixels]` messages (foreground only).
- Computer-use/runtime checks on Photoshop 27.4, 72-photo disposable project:
  confirmed native image/uncompressed output and loaded 410x512 thumbnails.
  First thumbnail took 2.69s; first ten took 19.06s. Native output alone does not
  fix cold entropy/IDCT cost. A cold 1536px preview render took 2.67s and retained
  one 150,543,360-byte component cache. These are single-run observations, not
  a benchmark guarantee. Photoshop's panel screenshot/AX calls repeatedly timed
  out, so DOM/image-load and render telemetry were inspected via the UXP debugger;
  this does not establish visual animation quality or physical key behavior.
- A subsequent 3072px cold render after cache expiry took 8.01s. The immediately
  following 6144px refinement reused component planes and took 1.28s (0.95s RGB
  output). Fit then generated zero additional rasters and kept the loaded
  4915x6144 image. These are different output sizes, not an apples-to-apples speedup
  ratio. This confirms reuse, but cold decoding is still an unresolved bottleneck.
- After the embedded-draft pass, a fresh native reload of the same 72-photo
  disposable library showed first paint at **295ms** and the first ten drafts
  at **479ms**, versus 2.69s / 19.06s for the earlier full-decode-first run.
  This compares first-visible latency, **not time to final quality**. An
  intermediate check showed ten of the first twelve at 410x512 and two still
  at 128x160; the later settled check confirmed all twelve at 410x512.
  Full-quality refinement remains sequential and can take substantially longer.
  The first 1536px popup raster took 2.71s on one image; another took 8.18s.
  These single-run timings do not establish a general latency guarantee.
- Further testing caught the old 30-second timeout evicting planes while the
  popup was still open. A later 3072px request was cold again (10.64s), and the
  probe labelled `Warm zoom QA` also had `reused:false` after another expiry;
  neither is warm-reuse evidence. The visible-popup lease fixes this lifecycle
  error. Fit still performed no new rendering in that run.
- Native regression verification of the lease retained the same single
  150,543,360-byte cache after 35 seconds with the popup open. The following
  3072px render reported `reused:true`, 370ms decode / 503ms total. It was still
  delayed behind an active background thumbnail, motivating the final
  refinement-pause policy. Those 503ms exclude queue and UI debounce time.
- Final native build with both fixes: first draft 280ms, first ten drafts
  474ms; cold 1536px raster 3.40s. After a 35-second open-popup wait the one
  component cache remained present. A 3072px zoom then reported `reused:true`,
  103ms decode / 136ms raster generation, and **859ms request-to-raster-ready**
  including the UI debounce and diagnostic polling interval. This measures
  generation readiness, not display scan-out. The test returned to Fit.
  The final production bundle is 756,515 bytes, below the unchanged 740 KiB
  ceiling; metadata (10), cache/scheduling (18), and library (40) checks plus
  cooperative decoder parity/lifecycle tests pass.
- Live screenshots now confirm the centered frameless popup, darkened library,
  fixed frame, image, details and thumbnail strip. Actual Space key events
  opened and closed the selected image without an intervening mouse click.
  A dispatched bubbling double-click also opened the preview; the computer-use
  service could not send coordinate mouse clicks to the floating Photoshop
  panel (`noWindowsAvailable`), so physical double-click and animation smoothness
  still need user validation. Pinch gestures remain explicitly out of scope.
- Debugger automation must dispatch a bubbling click event on the actual div
  control: calling `.click()` on UXP role-button divs did not activate them.
  The earlier `[Native review warm]` probe therefore did not zoom and must not be
  used as warm-render evidence; `[Zoom test B]` and `[Zoom Fit reuse]` are the
  successful corrected probes. Query descendants from the scoped element when
  reading UXP image dimensions.
- Cold JPEG decoding still processes source-resolution coefficients/planes.
  A 60–100MP uncached image can remain expensive and can temporarily exceed cache
  budgets during decoding. This is not a native scaled-IDCT or tiled decoder.
- This pass improves JPEG browsing. Existing unsupported-format behavior is not
  replaced with a new RAW/PSD/TIFF engine. Software JPEG RGB conversion is not a
  new ICC proofing engine; critical color evaluation still needs the original in
  Photoshop. Full native/tiled decoding would need a separately qualified path.

## Space / Escape focus follow-up

- Reproduced a missed Space open with no usable `document.activeElement` in
  Photoshop 27.4. Explicitly focusing the library viewport immediately restored
  Space opening. The host also logged failed focus attempts on the native Close
  button. The popup now focuses its own positive-tabindex dialog, and closing
  explicitly restores the positive-tabindex library viewport instead of trying
  to restore a stale or missing active element.
- Removed the 500ms post-close cooldown. The synchronous single-popup lease
  still covers opening, open and the 140ms exit transition, so repeated input
  cannot create duplicate popups. Once unmounted, the next independent Space
  can open immediately. Inputs during the exit transition are not queued.
- Both keyboard roots now share a deduplicating listener per handler; listener
  cleanup is synchronous with React layout effects. Space/Escape are normalized
  from legacy key codes too, and the modal does not discard its close keys just
  because a native control already marked the event default-prevented.
- Rebuilt and reloaded the plugin; native screenshots on the same 72-photo
  project verified Space open, Space close, Space reopen, Escape close, and
  subsequent reopen without an intervening library click. Space also closed
  after Tab inside the popup. Tight bursts during the exit transition are not
  a one-popup-per-key contract; host native-button Tab focus can still report a
  warning. No claim is made that Photoshop shortcuts work while another app or
  a text editor owns keyboard focus.
- `test:alb137` (40 checks plus cooperative decoder regressions), production
  build, bundle verification and `git diff --check` pass. Reloaded bundle:
  756,585 bytes, SHA256
  `0c56c4992cba02f39175d696a546a63df7d838982b6aa9671d45df0a71520943`.
- Adobe references: [UXP focus and tabindex](https://developer.adobe.com/photoshop/uxp/2021/uxp/reference-css/Pseudo-classes/focus/)
  and [KeyboardEvent](https://developer.adobe.com/photoshop/uxp/2021/uxp/reference-js/Global%20Members/HTML%20Events/KeyboardEvent/).

### Follow-up: focus loss after preview interactions

- The preceding open/close-only checks did **not** cover pointer zoom, navigation
  or decision buttons. The user reproduced a distinct failure after those actions.
  On the live zoomed 5.jpg preview, `document.activeElement` was `null` and an
  actual Escape did nothing. Restoring `.review-modal` focus made the next actual
  Escape close it. This isolates missing keyboard focus, not a missing close handler.
- Added a preview-scoped pointer-focus lifecycle: focus immediately and again on
  the next task after mousedown/click/wheel, and after a preview drag is released
  (including mouseup outside the frame). The delayed pass runs after host default
  focus changes and React control replacement. It neither cancels clicks nor
  repeatedly polls focus. Teardown cancels pending restoration so a closed popup
  cannot steal focus from the library.
- New behavioral regression simulates native focus loss after each event, drag
  release, unrelated document mouseup, and unmount before the deferred restore.
  41 library checks plus cooperative decoder regressions and production build
  pass. Bundle: 756,935 bytes (unchanged ceiling), SHA256
  `ec860f91d68a73f761be0962b4720866aa96c4752d9d41f86b96983af55655bc`.
- Reload succeeded and native Space opened the new preview. Physical pointer
  regression is pending user confirmation: the computer-control service again
  returned `noWindowsAvailable` for a coordinate click on the floating panel.
  Do not equate synthetic DOM clicks with verification of native pointer defaults.
