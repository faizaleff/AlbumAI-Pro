# Event management — first integrated build

Status: implemented and automated checks pass; not reloaded or visually
accepted in Photoshop yet. Bundle 757688 bytes, SHA256
`9fe8b4f8d0ae9ff55a219cb5c38bf9767cbca789d1e24d839924cc02aaab2a4e`.

## Behavior

- A single effective event list drives sidebar, event grouping and labels.
- Initial automatic groups still use the existing 30-minute timestamp-gap
  heuristic. This is not wedding-scene AI and camera-clock correction is not
  automatically applied. Visual classification remains a separate phase.
- Editing waits for supported JPEG metadata; pending status is visible.
- Manage events supports rename, new event from selected photos, selected-photo
  move, merge, event reordering and confirmed deletion. Existing drag/drop and
  inspector move controls use the same membership operations.
- Assignment is exclusive. Empty events disappear from visible lists. Empty
  automatic records retain origin keys internally for restoration.
- Deleting a custom event returns photos to their original automatic events.
  Deleting an automatic event puts its current photos in Unassigned. Neither
  deletes nor moves source files. Merge hides the emptied source but retains
  its original relationships. New/unmatched photos receive automatic membership.
- The first edit persists the effective auto/manual snapshot; names and original
  memberships survive reload. Subsequent added photos do not reassign existing
  edited memberships. Zero-photo manual drafts are not displayed.
- Successful edits enter existing event Undo/Redo history. Saving blocks duplicate
  submissions. Shared Library persistence handles project changes and rollback
  to last persisted state; event wrappers no longer duplicate save logic.

## Verification

Library suite including exclusive moves, original restoration, merge, reload,
normalization and no-photo-loss assertions passes. Decision persistence and
metadata suites pass; production build, bundle verification and diff checks pass.
No owner's event decisions were changed by automated tests.

## Owner acceptance after reload

1. Wait for metadata, open Events → Manage events, rename an automatic event.
2. Select photos from two events; create a named custom event. Check they are
   absent from originals, with correct counts/group labels.
3. Delete that custom event and confirm each photo returns to its own original.
4. Try move, merge, reorder and empty-event hiding; confirm Undo/Redo.
5. Reload and check names/memberships persist; source files remain untouched.
6. Verify native dropdown/text-field interaction and Escape in the new dialog.
# Sidebar revision

The popup has been replaced with inline sidebar controls at the user's request.
Double-click an event to rename it; + New event creates from selected photos.
Each row has a minus control with inline confirmation (never file deletion).
Drag an event onto the upper/lower half of another row to place it before/after.
Photo drops retain their existing move-membership behavior. Empty manual events
remain hidden; deleting a custom event restores original memberships.

Validation: 44 ALB-137 checks and production build/bundle verification passed.
Bundle: 757100 bytes. Native drag/double-click acceptance and reload pending.

## Continuation: event and photo drag feedback

The final failed turn in `CODEX TASKS` contained a newer request than the status
above: a three-line event drag handle, lift and reorder animation, inline rename,
and lifted single-photo / multi-photo stacks with event destination feedback.
That request was recovered from the prior task's latest user message. The older
cold-load/metadata measurement note is not the unfinished implementation for
this continuation. The preceding sidebar build had already been reloaded.

Implemented on `feature/alb-138-library-stabilization-polish`:

- The leading event handle lifts on hold or movement. A floating label follows
  the pointer; the upper/lower target half opens an insertion gap and line.
  Arrow Up/Down on the focused handle also reorders.
- Rename remains inline, with a pencil control as well as double-click. The
  editor explicitly focuses/selects its name; Enter saves and Escape cancels.
- Holding a thumbnail in Grid or List lifts a photo or selection stack. At most
  three existing thumbnails illustrate the stack; the label counts the entire
  captured selection. Dragging an unselected photo moves only that photo.
- The target event highlights and shifts slightly. A successful save animates
  the stack into the target; rejected saves show the existing error and do not
  show success. Sidebar edges auto-scroll during dragging.
- Membership still goes through `saveEventEdit` and existing event history and
  persistence. No membership changes happen during hover. Original files are
  untouched. A completed drop cannot turn into a selection-resetting click.
- Escape, pointer release outside a target, focus loss, workspace changes and
  unmount clear the gesture. Pending save completion cannot recreate a closed
  overlay. Up to three thumbnail URLs are retained only for the gesture and
  released on every cleanup path; dragging requests no extra image decoding.

The pointer controller uses document mouse events and timer-driven numeric
geometry. It does not depend on native HTML drag images or CSS transitions;
Adobe lists limitations for these in its
[UXP known issues](https://developer.adobe.com/photoshop/uxp/2022/uxp-api/known-issues).
This is implementation rationale, not proof of native animation smoothness.

The first build exceeded the 740 KiB ceiling. The build now shares the installed
Babel compiler's identical object-spread helper across modules instead of
embedding it repeatedly. No dependency or syntax-target change was needed.
Tests cover getter, descriptor, symbol and own-property semantics; Babel's MIT
notice is included in the generated license file. The ceiling stays 740 KiB.

Verification passed:

- `test:alb137`: 46 checks plus cooperative JPEG regressions, using the shared
  compiler helper. Drag tests use a deterministic clock and DOM, including
  intermediate animation frames, reorder/membership, cancellation, save failure,
  selection snapshots, disabled targets, auto-scroll and disposal during save.
- Metadata: 10 checks; thumbnail/cache scheduling: 18; decision persistence: 4.
- Production build, bundle verification, runtime bundle hygiene (8), runtime
  identity/support (18), and `git diff --check`.
- Final bundle: 726540 bytes; SHA256
  `d4b818e20eb12f59a32fc43ef88d87126d773c2b07d3ab2c4599bf61b84a49f0`.

No reload or physical Photoshop interaction was performed in this continuation.
Next: reload this build in the disposable project and check handle lift/reorder,
single/multiple photo stacks, edge scrolling, destination/drop motion, rename,
Escape cancellation, Undo/Redo, and persistence after reopening. Native pointer
delivery and animation quality remain unverified; automated tests do not close
that acceptance gate. Cold-load/metadata timings and the broader Library
acceptance checklist remain later work before Sequence.

Existing mixed working-tree changes were preserved. No commit, push, merge,
release package, or version change was made. The current user's explicit
approval requirement supersedes any older notes about commit/push permission.

## Follow-up: blocking Library preparation and visible grip

Owner reported that camera/event grouping finishes after the Library becomes
clickable, the grip is invisible, and the reorder ghost shows unwanted placement
comments. Implemented a full-workspace preparation screen, driven by the real
metadata batch count. It keeps native controls hidden and blocks background keys
until metadata, final grouping publication and cache persistence settle. Reading
and grouping cap at 99%; 100% is shown after the final render, then the workspace
opens. Unexpected batch failure offers Retry; unreadable individual photos are
counted as settled failures and leave an explicit sidebar warning, not invented
camera metadata or an endless loading state.

Metadata now runs at draft priority while expensive refinements are held. A
versioned cache restores complete facts only for matching photo ID, nonzero size
and known modification revision. Missing, legacy, incomplete or changed records
are re-inspected. Initial cache writes wait for hydration so they cannot overwrite
the saved facts before reading them. These changes reduce repeated work; native
reload latency has not been measured in this pass.

The event handle uses an explicit 14px stroked SVG within a contrasting 24px grip.
Reordering retains the event name and animated insertion feedback; directional
placement/save/success comments and drag tooltips are removed for event drags.

Passed: 47 Library checks plus cooperative JPEG regressions; 12 metadata checks;
18 cache/scheduler checks; production build and bundle verification; diff check.
Bundle: 730680 bytes, SHA256
`494c5321ce0a1b544186663d66d8864992cf980b24e7f3d41d7297a3cb35368f`.
Native Photoshop reload/visual acceptance remains pending. Check cold then cached
project reopen, progress reaching 100 before access, visible grip, and event
reordering without placement comments. No commit/push/package/version change.

## Follow-up: stable reorder geometry and context-menu moves

Owner observed camera/photo-type sections and scrollbar flickering during event
reorder. Hover had animated row margins and changed border thickness, changing
sidebar scroll extent and target geometry. Removed the margin changes and kept
border thickness fixed; insertion feedback now uses border color/inset shadow.
The floating event and target motion remain. Regression gestures reject any
attempt to change row margins/height/border width during hover.

Grid and List share a right-click “Move to event” action listing nonempty events.
The menu captures the clicked photo or existing multiselection, uses the existing
event save/history path, supports Escape, and clears on project/source changes.
The destination list scrolls and the menu is bounded to the panel. The grip now
uses shorter 1px strokes with a transparent background and retains its hit area.

47 Library checks plus cooperative JPEG regressions, production build, bundle
verification and diff check passed. Bundle: 731702 bytes; SHA256
`b65e3a29be48b44ea4ff60905cecd5104d4872fac4318cef24268f0897b496cc`.
Native Photoshop acceptance after reload remains pending: check stationary hover
between event rows, sidebar/scrollbar stability, and single/multiple photo moves
from both Grid and List followed by Undo. No commit/push/package/version change.

## Follow-up: rename isolation, complete drops and visible context menu

Owner reported clicks escaping an inline rename, incomplete multi-photo drops,
no drop-to-new-event flow, and an invisible context menu. Live UXP inspection
confirmed a mounted context menu with a 0 × 0 rectangle. Replaced its grid layout
with a flex column, explicit overlay edges, and a body portal. After development
reload and reopening the existing project, a synthetic thumbnail contextmenu in
Photoshop measured 220 × 108 and contained Move to event / Move to New Event.

Inline name/removal editors now capture outside pointer, keyboard, focus and drop
events until Save/Cancel. The drag controller also checks the editing lock. Photo
media no longer opts into native dragging; custom gestures suppress repeated
clicks and intercept native drop fallbacks using the original captured selection,
with a single persistence operation. The + New event row accepts photo drops;
its draft retains all captured photos, clears the ghost while naming, and saves
membership only on confirmation. Cancel does not write. Context-menu new events
also use the captured selection.

Passed: 48 Library checks plus cooperative JPEG regressions; 12 metadata checks;
18 cache checks; 4 decision persistence checks; production build, bundle verify,
and diff check. New regressions cover outside-editor actions, duplicate native
release/drop events, repeated click suppression, deferred naming, and persisted
multi-photo moves/new events. Bundle 732787 bytes, SHA256
`c4c536fc800fa7f0705d7e25252796c2706ca95d955d99d211bcc6d3fe6db3d0`.

Native menu layout was measured using synthetic DOM events in the actual UXP
runtime. Physical mouse multi-drag/rename acceptance in Grid and List remains to
be checked; do not treat the deterministic gesture tests as physical mouse QA.
The existing development plugin was reloaded; no commit, push, merge, packaging,
or version change was performed in this follow-up.

## Follow-up: hover destinations and context review actions

Right-click now opens a shared PhotoContextMenu for Grid/List. Hovering, focusing
or clicking Move to opens an adjacent Events submenu with existing destinations
and + New event. The submenu overlaps the trigger edge to avoid a dead hover gap,
opens left near the right panel edge, and scrolls within panel height. Review rows
close it when hovered. Rating 0–5 (0 clears), favorite/unfavorite and reject/unreject
apply to the captured selection using existing decision persistence and one Undo
checkpoint. Mixed selections offer Add favorite / Reject; uniform selections
allow removing those flags. Main menu and flyout retain the UXP flex/body-portal
layout that fixed the previous invisible menu.

49 Library checks plus cooperative JPEG regressions, production build, bundle
verification and diff check passed. Coverage includes mixed decision states,
flyout edge geometry and persisted decisions excluding unselected photos.
Bundle: 734711 bytes; SHA256
`12ab6f8dd6960607106012755600b265f65bed0b1393e2bb5d3f1668fe129555`.
This follow-up has not reloaded Photoshop or physically validated hover in UXP;
reload the development build for that acceptance check. No commit, push, merge,
packaging or version change.

## Follow-up: consistent popup rows, background menu and zoom bar

Replaced native context-menu buttons (UXP rendered them as outlined pills) with
ordinary accessible rows sharing LibraryToolbar's popup and option styles. Both
use a subtle shade on hover/focus. Photo review uses five stars, heart + Favorite,
and rejection symbol + Reject; selecting the current star rating clears it.
Removed the selection heading and internal dividing stroke from photo menus.

Blank viewport right-click now opens View / Sort / Group hover submenus using the
same control definitions and callbacks as the toolbar. It preserves the photo
selection. Photo right-click continues to act on its captured selection.

The footer now has a compact drag/keyboard zoom bar instead of pixel text and
separate view/size buttons: step 0 is List; step 1 is 124px thumbnails; steps 2–49
increase up to 172px. Toolbar view changes also update the slider position. Drag
updates are transient until release (or window blur), then use existing preference
persistence. Slider keyboard focus is excluded from Library photo shortcuts.

50 Library checks plus cooperative JPEG regressions, production build, bundle
verification and diff check passed. Tests cover zoom endpoints, full size
round-tripping, keyboard focus isolation, and avoiding native popup buttons.
Bundle: 738363 bytes; SHA256
`c73d971ad687a7d5ab1ca1470926360de42372ca2cdc739fc651fc8c12384371`.
Native Photoshop visual/drag acceptance requires reloading this build; it was not
reloaded in this follow-up. No commit, push, merge, packaging or version change.

## Follow-up: uniform photo action sizing and section separators

Standardized Move, rating, Favorite and Reject to 30px rows with 24px icon cells.
All action icons now use explicit 16px SVG geometry/strokes instead of differently
sized font glyphs; text rows use the same 13px normal-weight type. Added subtle
1px separators after Move and after rating, grouping the two decision actions.
Rating retains five stars and its existing toggle-to-clear behavior.

50 Library checks plus cooperative JPEG regressions, production build, bundle
verification and diff check passed. Bundle: 739309 bytes; SHA256
`8d57f269e426d7347c6d512975f80fde5ee4ac2464f7527000e7af196660d3ec`.
Native visual acceptance awaits development reload. No commit, push, merge,
packaging or version change.

## Follow-up: focused event naming and restored footer view icons

Added shared EventNameEditor for sidebar rename, new-event drops and context-menu
creation. It uses a body-level dim overlay and a larger 340px editor with labeled
input and styled Save/Cancel controls. The guard blocks background hover/move,
wheel, pointer and keyboard actions; Tab remains inside the editor. Saving locks
repeat submission/cancel and retains errors/name for retry. Naming now owns its
editing lock; the EventManager removal lock does not overwrite it.

Context-menu + New event replaces the popup with the name editor at the same
bounded screen position, saving the captured photos only after confirmation.
It no longer redirects naming into the sidebar. Drag-to-new still captures every
photo and opens the same editor. Grid/List icons are restored to the right of the
zoom bar, use existing switchView, and reflect slider-driven view changes.

50 Library checks plus cooperative JPEG regressions, production build, bundle
verification and diff check passed. Extended the editor guard regression to
background hover/pointer/wheel events and verified those do not repeatedly focus
the input. Bundle: 741841 bytes; SHA256
`3878688e5a9a1af0e8b0e2020c804d9486d99551a5979d3416cdd47d51544e27`.
Photoshop reload/physical overlay and naming acceptance remains pending. No
commit, push, merge, packaging or version change.

## Follow-up: native scrollbar overlap and compact anchored naming

Added a reference-counted background scroll lock for right-click menus and name
editors. UXP native scrollbars can paint over HTML overlays regardless of z-index;
background overflowing elements now temporarily use hidden overflow. Popup-owned
scrolling stays available. Original overflow styles and scroll offsets restore
only after the final menu/editor releases the lock.

Sidebar New event / Rename now reserve an inline area and anchor the overlay
editor to that same sidebar position/width. Right-click naming keeps its popup
position. The common editor is compact (260px for context naming), with smaller
padding/type/actions, no drop shadow, and no redundant field label. The input
retains its accessible Event name label; the dimmed editing isolation remains.

51 Library checks plus cooperative JPEG regressions, production build, bundle
verification and diff check passed. Added regression coverage for nested popup
scroll locks, preserving popup scrolling, and restoring background position.
Bundle: 742909 bytes; SHA256
`949a3eaf2618f60d0f7ed3b3e797d81a122ed69bd4b7e78266a74ac68cd25e34`.
Photoshop reload/visual acceptance remains pending. No commit, push, merge,
packaging or version change.

## 2026-09-11: stable soft scrollbars and truly inline event naming

Main Library sidebar, viewport and inspector now keep native overflow hidden and
use an overlaid 5px thumb. It appears on hover/wheel/scroll, stays briefly on exit,
and supports dragging; visibility never changes content width. Wheel updates the
real scrollTop so existing virtualization, keyboard reveal and sidebar drag
scrolling remain connected. Popup locks hide these thumbs. Binding refreshes when
virtualized surfaces mount/unmount and restores styles/listeners on teardown.

Removed the coordinate-positioned clone for inline naming. Sidebar editors now
render in their actual event row. Four dim mask panels surround the measured
editor without moving it, retaining interaction isolation. Context + New event
now replaces that row inside its existing Events flyout with the name input and
Save/Cancel; it no longer opens a separate dialog. The flyout can grow within the
remaining viewport space. Captured-photo membership and retry behavior remain.

52 Library checks plus cooperative JPEG regressions, production build, bundle
verification and diff check passed. New soft-scroll regression checks geometry,
wheel updates, invariant overflow/width and teardown. Bundle: 745602 bytes;
SHA256 `da9a941a8ed51f1e79fb41da5cb96e630d7d143b367e42a206823f7b0aa64c57`.
Physical Photoshop acceptance after reload remains pending. No commit/push/
merge/package/version change.

## 2026-09-11 correction: restore native trackpad scrolling

Owner reported disappearing images and broken two-finger scrolling after the
soft-scroll implementation. Removed its overflow replacement, wheel cancellation,
scrollTop writes, body-mounted thumbs, drag handling and polling. Restored the
photo viewport's overflowY:auto. Sidebar and inspector also retain native scroll
mechanics. The new binding only observes scroll/passive wheel events to add a
short-lived CSS activity class. Hover/activity changes thumb color to light grey;
width stays fixed at 6px where the host supports scrollbar styling. Unsupported
styling must fall back to the host's native scrollbar, never replace scrolling.

52 Library checks plus cooperative JPEG regressions, 12 metadata/virtual-window
checks, production build, bundle verification and diff check passed. Replaced the
soft-scroll test with a regression that rejects gesture cancellation or scrollTop
writes, including horizontal and vertical trackpad deltas. Bundle: 744092 bytes;
SHA256 `57a78ced55f588d7a7b34859e100b99a15c0a9452c9c0a54e62ed6989ec8a93d`.
Native trackpad acceptance and scrollbar appearance need Photoshop reload; no
physical gesture verification was performed here. No commit/push/merge/package/
version change. This correction supersedes the earlier custom soft-scroll entry.

## 2026-09-11: thinner activity-only scrollbar styling

Reduced supported native scrollbar styling from 6px to 4px, with a muted grey
thumb and 500ms activity timeout. Idle/unhovered remains transparent; no overflow,
scroll position or gesture handling changed. 52 Library checks, cooperative JPEG
regressions, production build, bundle verify and diff check passed. Host rendering
of the 4px styling still requires Photoshop verification. Bundle 744092 bytes,
SHA256 `4efe7fa771bbd12fd64e9be77b6288700518e7db1bab22663fb66cc1b271769d`.
No commit/push/package/version change.

## 2026-09-11 correction: no popup/preview scroll-surface mutation

Removed the background overflow lock from context menus and event naming. Removed
review-open rules that forced hidden overflow and zero-width scrollbars in normal
and burst previews. Those rules changed Library geometry and could reset UXP
scroll positions; popup opening no longer explicitly hides native scrollbars.

Focus now requests preventScroll and restores only positions actually changed by
that focus call, covering sidebar, viewport, inspector and list scrollers. Context
menu entry/exit, normal preview entry/exit/pointer refocus, burst preview and name
input use this path. Removed the stale burst sidebar-only close snapshot.

52 Library checks plus cooperative JPEG regressions, 12 metadata/window checks,
production build, bundle verify and diff check passed. Regression simulates UXP
ignoring preventScroll and verifies all current positions survive without any
style/overflow writes. Bundle: 743567 bytes; SHA256
`af45a5f273c6e58068597ad848d2061b4611a900d7e9ab739458bc39d1561c00`.
Photoshop reload/physical scroll-position acceptance remains pending. No commit,
push, merge, packaging or version change. This supersedes background-scroll-lock
behavior recorded above.
