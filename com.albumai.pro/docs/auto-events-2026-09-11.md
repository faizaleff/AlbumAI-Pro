# Auto Events — local model implementation

## Earlier foundation (superseded by local implementation below)

User requested image-content event recognition, not timestamp grouping.
The repository has no production image embedding / ceremony classifier model.
A local-versus-cloud runtime question is pending. No photos were uploaded and no
model/API/runtime was installed. Existing runtime and event behavior are unchanged.

Implemented provider-independent PhotoAutoEvents domain functions:
- sequential scene analysis with progress and cancellation;
- semantic scene embedding + confident label proposals, with no EXIF fallback;
- unknown/failed/low-confidence photos remain reviewable;
- selected proposal application preserves other memberships, origin keys, names,
  order and source objects; rejects mismatched libraries and unknown proposals.

Tests use synthetic scene evidence. They test orchestration, proposal validation,
partial application and cancellation; they do NOT establish recognition quality.
Similarity/confidence thresholds are provisional and require calibration with
real model outputs and representative wedding photos before production exposure.

Still required: runtime/model choice, actual image inference adapter, visual
suggestion review UI, persistence integration, real photo quality evaluation,
Photoshop acceptance. New domain module is not imported by the production UI;
there is deliberately no nonfunctional Auto Events button or fake AI fallback.

Library regressions and production build were run. No commit/push/package/version
change. Continue from these files after the runtime choice; do not treat the
feature as complete.

## Local model implementation

User explicitly selected a local model. Installed Google SigLIP base patch16 224,
revision 7fd15f0689c79d79e38b1c2e2e2370a7bf2761ed, plus an isolated Python 3.12
runtime in ignored local-ai/. The worker is offline and uses a private file
bridge, not HTTP/cloud or source-folder access. Photoshop stages one temporary
photo copy, atomically publishes the request, and removes the copy afterward.
The native copy API required a separate moveTo rename; passing newName to copyTo
was ignored by UXP and was corrected after a real 72-photo run.

Added AutoEventsDialog and LocalPhotoEventProvider to production Library.
The native folder picker saved the model connection; it survives plugin reload.
Scene suggestions have editable names, group inclusion, paged photo samples,
Needs review photos, Cancel and Apply. Application uses the existing save/Undo
transaction, validates source membership/revisions and prevents event-capacity
truncation. No automatic photo move occurs on Analyze or project reopen.

Real local inference produced 768-dimensional scene embeddings. Non-wedding
local test photos were left for review; a bridal portrait isolated from the
owner's screenshot was classified as Individual Portraits. These are smoke
checks, not a representative quality benchmark.

Native Photoshop acceptance: opened Auto Events, connected the local worker,
reloaded and verified remembered connection, started analysis and cancelled
without applying. On the corrected copy handoff, all 72 Library photos were
processed: 2 suggested groups, 31 review photos, no unreadable-photo count.
The first result's tiny image samples were incorrectly cropped; explicit image
fit sizing was added. Ceremony/portrait text alternatives were narrowed after
review. A final native rerun after that refinement was blocked by Computer Use
returning noWindowsAvailable for pointer actions, despite the Library screenshot
and accessibility tree being available. The earlier 72-photo counts are not a
measurement of the final prompt revision. Final thumbnail fit needs visual
confirmation; the production bundle loaded successfully with all 72 photos.
No application error was observed in that final Library view.

57 Library assertions plus JPEG regressions; 12 metadata/window assertions;
2 Python bridge tests; production build, bundle verification, diff check passed.
Bundle 757687 bytes, SHA256
b436d37c00a21492fb03cac4da54c31b07f6242e3f85858e24923a79895b9355.
No commit/push/merge/package/version change. No real project Apply was performed.
See auto-events-local-setup.md for startup, model provenance, local staging and
known model limitations. Synthetic debugger actions used during diagnosis are
not counted as native pointer acceptance.

## Connection recovery

User reported analysis unavailable after connecting. The worker log established
an actual crash: Photoshop consumed a response between the cleanup glob and
stat, raising FileNotFoundError and removing ready.json. Cleanup now tolerates
that normal concurrent deletion and continues removing other abandoned files.
A regression test reproduces that race. All 3 worker tests, production build,
bundle verification and diff check passed. Restarted worker and verified fresh
ready.json plus model-ready log. Existing saved connection and photos unchanged.

## Follow-up model comparison

Completed the approved 24-photo local comparison; see
`auto-events-model-comparison-2026-09-11.md`. Both candidate models are installed
and verified in the ignored comparison directory. Qwen per-photo broad labels
were more useful on this portrait sample. The Google + representative-Qwen
hybrid missed three clear misclassifications and was not promoted to production.
Original event memberships and production provider remain unchanged.
