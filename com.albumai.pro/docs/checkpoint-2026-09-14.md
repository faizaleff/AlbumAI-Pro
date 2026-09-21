# Library and experimental Auto Events checkpoint

Checkpoint on feature/alb-138-library-stabilization-polish; version remains 1.2.0. This is a development draft, not a release or completed host qualification.

Includes Library metadata/load gating, cooperative JPEG previews, event editing/moves, review/context menus/scroll preservation, and optional local and Gemini Auto Events with explicit upload consent, secure key storage, chronological names, scene summaries and timing.

Validation: 64 Library domain groups plus cooperative JPEG regressions, 12 metadata assertions, 18 thumbnail cache assertions, 20 offline Python AI tests, production build, bundle verification and whitespace check passed. Full historical CI suite was not run locally. No new cloud calls or user project changes during checkpoint validation.

Remaining: photographer-verified grouping accuracy, whole-album continuity, camera time offset correction, location metadata support, persistent online analysis cache/resume, and Photoshop interaction acceptance (native computer-use clicks have failed). Equal-time/multi-cue grouping is tested offline but still needs a live image run. No professional event-boundary accuracy claim.

Private photo/model/runtime data under local-ai remains ignored. Example documentation paths are anonymized. The wedding comparison launcher accepts an optional prepared-sample folder argument; its generic default is local-ai/comparison/wedding-sample. Existing private sample folders are untouched; pass their path explicitly to reuse them.
