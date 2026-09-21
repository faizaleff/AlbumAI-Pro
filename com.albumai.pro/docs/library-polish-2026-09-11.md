# Library usability polish — 2026-09-11

Continues the existing feature/alb-138-library-stabilization-polish workspace.
Existing changes preserved. No version change, commit, push, merge or packaging.

## Implemented

- Clear Filters resets query fields while preserving thumbnail size and sort;
  separate view/group state is untouched.
- Focus reconciliation recovers a visible selected photo after an empty search
  result, while retaining a valid focused photo. Right-click focuses the clicked
  photo even within a multi-selection, without replacing that selection.
- Full-screen normal/burst review suppresses painting of the background Library
  workspace using visibility, leaving mounted scroll surfaces and their geometry
  intact. No overflow changes, scrollbar-width toggles or scrollTop reset added.
  Native host effectiveness still requires visual acceptance.
- Compact Photos header; removed duplicated count/Sequence locked notice and
  unavailable Publish tab. Added inspector collapse and on-demand shortcut help.
- Active query/facet chips with individual removal and Clear filters.
- Simplified source spacing, neutral default facet rows, metadata label/value
  rows, lighter rejected-photo shade and consistent burst button colours/shapes.
- Event column correctly labelled; inspector Keywords renamed Tags to reflect
  its existing content. Inspector file size reads fileSize used by list data.
- Automatic Event N timestamp labels display compactly; full names remain in
  titles and saved data. Successful move/new event operations show status text
  pointing to existing Undo controls.
- Existing context menu sections, inline event editor, zoom slider and Grid/List
  icons retained.

## Verification

53 Library assertions plus cooperative JPEG regressions; 12 metadata/window
assertions; production build; bundle verification; git diff --check all passed.
New behavior tests cover query reset without presentation reset and focus
recovery through empty/matching results without choosing unrelated photos.
Bundle: 745268 bytes, SHA256
93c59aa816455f3aa54a1b2ab19cb9d50b4dafc7a540fddb742e5c60e3fd60db.

The final verified production build reloaded through UXP Developer Tools. Photoshop
returned to its project opener. Native coordinate clicks repeatedly failed with
Computer Use noWindowsAvailable, preventing project reopen and visual acceptance.
Do not report this as a passed live scrollbar/trackpad test. The existing project needs opening before physical acceptance.

## Acceptance still required

At nonzero sidebar/grid/list scroll positions: right-click, dismiss, normal
preview, burst preview, Escape, and repeat with two-finger scrolling. Confirm no
scrollbar overpaint, position reset, blank photos or focus jump. Verify inspector
collapse, filter chips, compact labels and move status in the native host.

Optional column chooser and thumbnail-overlay customisation from the review
were not added in this pass; no new settings panel was introduced.

## Follow-up: scrollbar repaint after Next / preview controls

Owner reproduced overpaint after interactions in normal and burst preview.
Visibility-only suppression is insufficient for the native host. Both preview
lifecycles now share suspendLibraryReviewScrollbars for their whole mounted
session. It temporarily removes background native scroll surfaces with hidden
axis overflow, compensates removed gutters, and retains original dimensions for
the virtual grid's measurements/navigation. Close restores original inline
styles first, then the exact scroll positions. Next/zoom/decision renders do not
reacquire or release the suspension. Context menus remain unchanged.

This supersedes the earlier claim that preview requires no overflow mutation.
The regression covers nonzero two-axis positions, repeated focus changes during
suspension, stable virtual width, exact style restoration and idempotent cleanup.
54 Library checks plus JPEG regressions, 12 metadata/window checks, production
build, bundle verification and diff check passed. Bundle 746461 bytes; SHA256
42b7f37d21066cdd23d585132dd9993176885458afbeeab3a0ae22842f0aa1fb.

Computer Use read the active existing Library, but native coordinate click again
failed with noWindowsAvailable. The running project was left open; this final
build has NOT been reloaded. Native Next/zoom/burst/close acceptance is pending.
