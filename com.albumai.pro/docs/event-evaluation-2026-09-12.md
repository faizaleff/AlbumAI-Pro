# Diverse event evaluation — preparation

User approved testing event grouping beyond the completed 22-photo portrait comparison. Requested a folder path containing different wedding stages; no new folder supplied yet. Do not substitute the portrait sample or infer photographer ground truth from AI labels. No new uploads performed.

Added offline `scripts/local-ai/evaluate_events.py`. It reads a photographer-reviewed chronological sequence and scores broad-label correctness separately from event-occurrence boundaries. Review/accepted coverage and missing predictions are explicit. It detects false splits and false merges, including separate occurrences sharing the same broad label. Unknown boundaries are excluded from known-only precision/recall and separately counted with coverage; missing predictions never become perfect scores. Requires unique photo ids, explicit review flags, ground-truth labels and contiguous ground-truth event occurrence ids.

Next work after folder path arrives:
- Prepare a separate small preview sample covering Getting Ready, Ceremony, Family, Portraits and Reception where present, with adjacent photos around transitions. Preserve previous comparison files.
- Have the photographer verify chronological order, category labels and event occurrences; camera clocks/filename order alone may be misleading.
- Show the exact preview sample before new cloud uploads. Previous SEND 24 covers the earlier sample only.
- Run classification/grouping, then evaluate predictions against the verified labels and event boundaries. Do not invent an accuracy number before human ground truth is available.

Validation: 20 local-AI tests pass, including four event-evaluation cases; production build, bundle verification and diff checks pass. Production provider and memberships remain unchanged. No release actions.

## Source supplied and preview sample prepared

Source: `<private wedding source folder>`, readable without escalation. Found individual photos under engagement, oputhambalam, reception and wedding camera folders, plus album print spreads. Excluded PSD/Print spreads and the singleton JPEG outside the main camera folders.

Prepared a separate `local-ai/comparison/wedding-sample` sample: two adjacent filename-order photos from the middle of each of 11 camera/source folders, plus first and last from wedding candid 1, total 24. Visually inspected the contact sheet: rituals/ceremony, family groups, couple portraits and detail imagery are represented. No independent Getting Ready coverage established. Sampling order is NOT verified chronology, and folder labels are not ground truth. Boundary scoring must not be run on this folder-concatenated overview as though it were a chronological sequence.

Previews are reconstructed RGB JPEGs at maximum 768px, stripped EXIF, with hashes. Local manifest retains relative provenance and available capture time for later review; request payloads contain neither. Originals and all earlier experiment artifacts are preserved. Gemini runner now accepts `--folder` for isolated prepared samples. New launcher: `scripts/local-ai/start-wedding-comparison.command`; review: `local-ai/comparison/wedding-sample/gemini-3.1-review.html`. No new upload occurred; user must review/approve this new sample and enter key locally. Twenty tests and production build/bundle verification pass.

## Live diverse-sample classification completed

User explicitly approved the new 24 previews and ran the launcher successfully. Verified all 24 results: 73.496066 seconds cumulative request time; estimated USD 0.008457 from complete usage metadata. Categories: Ceremony 9, Family & Guests 11, Individual Portraits 2, Couple Portraits 1, Other 1. Photo id 21 (RK114703.jpg) alone requests review. Model review flags are not accuracy or confidence calibration.

Visually reviewed the contact sheet against output. Many group/ritual labels are plausible, but scene labels do not identify the actual event occurrence: reception and wedding group photos both get Family & Guests; broad Ceremony labels also cover distinct contexts. Single images do not establish exact ritual identity. Detail-versus-portrait interpretation (id 23) and context-dependent Ceremony assignments need photographer review. No human ground-truth accuracy is claimed and no chronological boundary evaluation was run.

Next required design: keep event occurrence (e.g. this reception session) separate from shot category (e.g. family portrait), use verified chronology/adjacent context for proposed boundaries, and review ambiguous transitions before applying memberships. This is still an experiment; do not promote label-equality grouping as professional Auto Events.

Removed the report's hardcoded portrait-heavy description because it did not apply to this second dataset, and regenerated its offline report only. No network calls or new uploads were made by the agent. Earlier local comparison files and original photos remain unchanged.

## Event-occurrence proposal implementation

Implemented in `PhotoAutoEvents.js` and the existing Auto Events review dialog:
- Separate photo category from event occurrence name; suggestions use editable Event N names and category counts within the group.
- Process capture metadata chronologically, independent of UI/provider order; never use file-modification time or filename as capture time.
- Compare only adjacent accepted photos and the current occurrence anchor. Never search earlier category-matching groups. Require visual similarity >=0.80 plus positive capture gap <=30 minutes to join. These are conservative uncalibrated proposal thresholds, not verified event boundaries.
- Split low-similarity/tied-time transitions into review-required suggestions and flag both adjacent groups. Analysis gaps interrupt continuity and flag neighboring groups. Missing capture-time photos stay in existing events for review; incomplete timelines flag remaining proposals too.
- Ambiguous suggestions are not preselected. Apply remains explicit, preserves existing names/memberships of untouched photos and uses existing Undo/persistence. Re-check capture timestamps at Apply, alongside file revisions, so changed metadata invalidates stale proposals.

This change is wired to the currently connected local embedding provider. The Gemini experiment supplies broad labels without scene embeddings and is not silently treated as equivalent evidence or connected to production. Online adjacent-context extraction/integration and photographer-verified boundary validation remain separate work. Camera clock offsets are not corrected by this patch; simultaneous/missing/ambiguous timing is reviewable, and apparently valid but incorrect clock metadata remains a limitation. No claim of professional automatic event-boundary accuracy.

Validation: Library/JPEG regression suite passes with 58 domain assertion groups, including new same-category separate-session, mixed-category same-context, scene-transition review, missing/tied timestamps, uncertain analysis gaps, provider-order independence and changed-timestamp apply rejection cases. Metadata suite: 12 assertions pass. Production build and bundle verification pass. Bundle 759658 bytes; increased the explicit build ceiling from 740 to 742 KiB for the measured ~2 KiB addition. No version change or commit/push/merge/package. Photoshop runtime interaction has not been revalidated for this change.

## Optional Online AI integration

Implemented `GeminiPhotoEventProvider` and an Online AI mode in the existing Auto Events dialog. Local remains the default. User saves/removes their own key through UXP secureStorage (no key in source, project files, logs or prompts). Manifest allows only the Google Generative Language HTTPS host. Online mode displays paginated selected-library thumbnails, explains per-request previous/current previews, billing/data terms and JPEG-only coverage, and requires fresh explicit consent before analysis. No automatic network request on opening or saving a key.

Previews use the existing cooperative JPEG decode/orientation/resize pipeline at max 768px, returning temporary RGBA pixels and encoding clean PNG with no EXIF, filenames or paths. Non-JPEG photos stay for review. This adds no local model download requirement. Gemini 3.1 Flash-Lite compares previous/current preview content and supplies category plus same/different/uncertain event context. The domain validates the preceding photo key, processes capture chronology, and uses this contextual relation rather than category equality. Time/ambiguity safeguards from the previous implementation still apply. No fabricated embeddings/confidence are created for Gemini.

Requests use fixed HTTPS endpoint, key header, no redirects, 90s abort, cancellation polling, and no automatic retry. Session scope disallows unknown/duplicate photo keys. Fatal API errors stop the run; starting a fresh user-approved analysis can resend and incur charges. No persistent analysis cache or automatic resume yet. Mid-run fatal failures do not apply partial memberships. Paid-service terms and token rates are disclosed, but billing cannot be verified from a key. Current image-pair workflow may send a preceding preview more than once, as disclosed; its cost is not the earlier single-photo benchmark cost.

Validation: 60 Library domain assertion groups/JPEG regressions pass, including consent/no-upload, scoped pair context, category-independent merging, cancellation, duplicate protection, payload privacy and secret-safe error checks. Metadata suite 12 assertions passes. Production build/bundle verification passes. Runtime ceiling increased from 742 to 750 KiB for the optional provider and UI; bundle measured 766565 bytes before the final online scroll-container class adjustment. No version/release actions.

CUA: UXP Developer Tools reported Plugin Reload Successful. Photoshop displayed project landing screen, but clicking Open Existing Project returned `noWindowsAvailable`. AX focus/keyboard fallback did not activate the custom button. Cannot claim Photoshop online UI or network end-to-end validation. No key entered, no new photos uploaded, no memberships applied. Latest build includes online setup scroll containment and needs the usual development reload before the user's live test. Remaining host checks: secure key save/remove; RGBA-to-PNG Blob.arrayBuffer support; manifest network permission after reload; consent and paired-image generation; review/apply/Undo using disposable project. Avoid repeated reloads with unsaved user work.

## Photoshop online failure diagnostic follow-up

User screenshot shows generic "Online analysis stopped" after using Online AI. This catch covered fetch, response parsing and classification parsing, so the root cause cannot be established from that message. Added fixed, secret-safe stage codes (NETWORK_PERMISSION, REDIRECT, ABORTED, NETWORK_REQUEST, RESPONSE_JSON, CLASSIFICATION_JSON), and explicit cookie omission. No arbitrary error strings/response bodies are exposed. No transport security relaxation or automatic resend.

Added Check connection (no photos): explicit user action sends one tiny Reply OK generation request with the saved key to the same model, without any photo content. It discloses possible token cost and disables Analyze during the check. Success means API response JSON was readable, not that image classification is validated.

61 Library domain assertion groups/JPEG regression tests pass, including secret redaction and text-only probe scope. Production build/bundle verification and diff check pass (768520 bytes; bounded ceiling 753 KiB for diagnostic code/UI). CUA confirmed full Plugin Unload Successful followed by Plugin Load Successful, refreshing the network manifest rather than only JS reload. Key was neither read by the agent nor entered again; no photo upload was triggered. User must reopen their project/Online AI and run Check connection to obtain the exact host result. Root cause and live photo fix are still unverified.

## Online performance improvement

User reported slow analysis at 1/72. Code inspection found uncompressed PNG preview upload and fully serial preparation/network work; these are concrete avoidable costs, not proof that network latency alone caused the observed wait.

Replaced PNG preview encoding with existing jpeg-js encoder at quality 78, retaining max 768px and orientation/EXIF stripping. It is fed only resized RGBA/width/height, never original EXIF. Production uses the existing minimal Buffer alias, avoiding a full Buffer package. Added bounded one-photo lookahead: next chronological preview prepares while current Google request is in flight. Requests remain sequential, scoped and non-retrying; previous/current adjacency stays intact. Progress now separates preview preparation, Google wait and result parsing, with elapsed per-photo time.

Measured on the 24 prepared diverse sample copies in Node: JPEG 2,252,044 bytes versus 37,762,816 raw bytes in the previous uncompressed PNG representation (~94.0% lower, excluding small PNG framing). Decode+encode 734ms for 24 reduced copies. This is a payload/local diagnostic, NOT Photoshop source-decode timing or measured cloud latency/speedup. JPEG quality changes could affect fine detail; next live run should verify quality and end-to-end timing.

62 Library assertion groups/JPEG regressions pass, including actual compressed JPEG decode/no-EXIF, and one-lookahead preparation before network response with only one request in flight. Production build/bundle verification passes; bundle 775836 bytes, ceiling 759 KiB accommodates the small encoder. No automatic uploads or release actions. Did not reload Photoshop during the user's active analysis; new code takes effect on a development reload after that run finishes or is cancelled.

## First Photoshop online suggestions observed

User screenshot confirms the host analysis completed with 19 suggested events, zero unassigned photos, and multiple review-required event boundaries (only one group selected). This is evidence of host online classification/proposal completion, not correct boundary accuracy. Cannot infer runtime or whether latest JPEG optimization was used from the screenshot.

Fixed misleading summary: now separately counts review-required event boundaries and unassigned photos. Previously "0 photos need review" only counted unassigned photos despite visible group-level review. Corrected Apply 1 event grammar. Added explicit 94% border-box result-dialog height, zero flex basis/min-height on result scroll area, and contained wrapping action footer to address observed footer overflow in UXP. Existing proposal and running plugin were deliberately not reloaded; current user results are unsaved in memory. Library tests (62 groups), build, bundle verification and diff checks pass. Live footer layout awaits verification after next reload.

## Applied event fragmentation and descriptions

User applied all 19 suggestions and requested computer-use inspection and visible Gemini descriptions. CUA screenshot confirms several one-photo Events and selected Event 16's portraits. Clicking a custom event row still fails with noWindowsAvailable, so full interactive group-by-group verification is unavailable. Read-only inspection of the saved disposable project confirms 19 populated Events totaling 72 photos, including 12 singletons. Existing per-photo Gemini boundary evidence was not persisted, so the exact cause of each split cannot be reconstructed. Current conservative pairwise splitter separates every uncertain transition and positive-gap requirement also splits tied capture times; these remain likely contributors, not demonstrated causes for this particular run. No memberships were merged or rewritten.

Added short factual sceneDescription to the existing Gemini response schema (same requests, no separate summary upload). Proposals retain up to three distinct bounded photo scene descriptions as a scene summary, display it in review, persist it through chapter normalization/Apply/save, and show it beneath selected events in the sidebar. This is a selection of photo descriptions, not a separate whole-event synthesis or verified event name. Existing applied events have no retained descriptions and are not fabricated/backfilled. New analysis after reload is needed for descriptions. No cloud requests or Photoshop reload performed by the agent.

63 Library domain assertion groups and JPEG tests pass; production build, bundle verification (776914 bytes), and diff check pass. Description persistence/rename, deduplication and invalid-value handling covered. Host description layout remains unverified. Next grouping improvement should assess multi-photo continuity and expose uncertain boundaries for review rather than silently merging existing singletons or using category equality as event identity.

## Chronological names, bulk selection and review timing

Auto Events suggestions now receive chronological serial numbers plus a compact name from the dominant recognized photo category (for example 1. Couple Portraits). Categories remain content labels, not proof of a ceremony identity. Capture-time sorting still determines order; missing capture times stay unassigned for review. Names remain editable and are persisted through Apply. Existing applied Events are unchanged.

Added explicit Select all and Clear selection alongside existing individual toggles, including review-required groups only when the user explicitly chooses them. Added total elapsed analysis time, current photo elapsed time, completed per-photo timing list while running, and duration badges on paginated review thumbnails (including unassigned photos). Uses local wall-clock timings for preparation plus response processing, not a claim of Google-only request latency; overlapping preparation means these are pipeline timings. Changed provider waiting stage to Waiting for review; provider/billing/upload disclosure remains in setup. No extra network requests, uploads, retries, or concurrency were introduced. Existing compressed JPEG and one-preview lookahead remain the speed improvements awaiting live measurement.

63 Library assertion groups/JPEG tests pass, including chronological names and timing coverage for failed images. Build initially exceeded the prior 759 KiB ceiling with the added UI; bounded ceiling now 761 KiB. Production build, bundle verification and diff check pass. No version changes or release actions. No Photoshop reload or re-analysis, so current applied work remains intact; new UI requires development reload and a future user-started analysis.

## Multi-cue event context and equal-time splits

User screenshots show 20 groups / 19 review-required groups, including visually similar couple portraits split at exactly equal capture timestamps (18 ends where 19 starts; 19 ends where 20 starts). Code confirmed gap > 0 forcibly split equal timestamps regardless of positive Gemini context. Online proposals now join equal-time adjacent photos when context agrees, retaining camera-order review. Local embedding behavior unchanged.

Gemini structured response now compares setting, attire, activity and event flow separately as same/different/unknown; prompt explicitly excludes crop, pose, camera-angle and individual-to-couple portrait changes as standalone event boundaries. No location/address inference, extra image upload, timestamp/EXIF transmission or additional request was added. This is still adjacent-pair visual assessment plus local capture chronology, not a whole-album temporal model. Exact address/GPS integration and camera-offset correction remain unsupported.

For online evidence, two agreeing cues with no changed cue can retain an uncertain adjacent pair in one review-required group. Explicit different-event results, contradictory cues, missing analysis and unavailable timestamps still prevent this join. Strong same-event context with multiple agreeing cues can span 30–120 minutes, requiring review; beyond two hours still splits. These bounded thresholds are heuristics, not validated professional boundary accuracy. Existing applied events and current live proposals are not modified or reloaded.

64 Library assertion groups/JPEG tests pass, including tied time, category change within context, uncertain corroboration, single-cue insufficiency, explicit split, contradictory setting, extended gap review and long-gap separation. Production build and bundle verification pass with bounded 762 KiB ceiling for added context rules/schema; diff check passes. No network requests made. New model schema/real-image grouping quality awaits a user-started live analysis after reload.
