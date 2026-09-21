# Library checkpoint verification — 2026-09-14

Follow-up to checkpoint `23beb1d` / draft PR #56. No architecture re-audit was performed. The current source/build version remains 1.2.0; these changes are local and uncommitted.

## Changes to stale verification gates

- Isolated folder-transaction tests from background metadata updates while asserting exactly one metadata extraction launch for a successful folder change. Dedicated metadata tests remain in the full suite.
- Updated burst quality fixtures to supply AI rank evidence; user star ratings alone must not count as quality evidence.
- Replaced obsolete blanket network prohibition with an exact HTTPS Google generation-origin allowlist. Arbitrary domains, wildcard permissions, extra origins and HTTP remain rejected. Source/built manifest agreement remains required.
- Aligned development bundle checks with the current 763 KiB cap. Historical candidate/publication test envelopes are now 779 KiB with a 16 KiB reserve, leaving the same effective 763 KiB ceiling. This is a changed budget, not a size reduction or new release qualification. Actual bundle: 780372 bytes, only 940 bytes below the development cap.
- Registered the 21 Library/Auto Events/preview modules already introduced by the checkpoint. All 144 active files must still be reachable from the canonical entry and the test import graph. Updated graph counts, retained the historical ALB-050 baseline and retired-file checks. JSON test fixtures are parsed as JSON rather than JavaScript.

## Verification

- `npm run verify`: PASS (entire test suite, architecture, regression graph, hardening, production build, runtime bundle and typography readiness checks).
- Architecture: 313 assertions, 144 reachable source files.
- Regression graph: 1334 assertions, 144/144 active files reached. This measures import reachability, not behavioral test coverage.
- `npm run distribution:verify`: PASS (inspection only).
- `npm run deps:check`: PASS.
- `git diff --check`: PASS.
- Bundle SHA-256: `208e11f618f254d7de8b2383a421f95dd6664f7b821e3e3b8f51c1252434bcd2`.

The remote PR check remains the earlier failed run until these fixes are committed/pushed and CI reruns. A fresh network dependency audit was not run. No release package was produced or retained, and no merge, version change or photo upload was performed.

## Remaining acceptance

Photoshop screenshots can be read, but computer-use coordinate clicks fail with `noWindowsAvailable`. More/Less expansion and the new single/multi-photo collage context-menu interactions remain unverified in the host. No plugin reload was forced over the user's current project. See `library-collage-labels-2026-09-14.md` for implemented behavior and automated coverage.
