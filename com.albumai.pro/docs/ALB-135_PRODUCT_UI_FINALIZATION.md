# ALB-135 — Product UI Finalization

Status: **implementation in progress — Import/Sort/Cull started**

Date: 2026-09-01

## Objective

Finalize the AlbumAI Pro product interface before permanent-logo integration,
Marketplace screenshot capture, or final `v1.2.1` package qualification. This
milestone improves hierarchy, clarity, responsive containment, and runtime
discoverability without adding new product features.

## Evidence reviewed

The audit combined:

- the current `OpenFolder`, photo-browser, template, execution-details, and
  stylesheet sources;
- prior wide-panel runtime captures of Import and Design workflows;
- the live Photoshop 2026 document and Plugins menu; and
- the existing AlbumAI entry in Adobe UXP Developer Tools.

Computer Use found the plugin initially **Not loaded** in UXP Developer Tools.
After the existing local plugin was loaded successfully, selecting **Plugins >
AlbumAI Pro > AlbumAI Browser** did not surface a visible panel in the captured
Photoshop workspace. A subsequent Manifest v5 lifecycle correction and clean
unload/load confirmed that the ALB-135 workspace is mounted in a 900x700 panel
document. Resetting the Essentials workspace and expanding Photoshop's
collapsed secondary panel dock then surfaced **AlbumAI Browser** visibly. This
classified the original symptom as saved workspace/dock placement rather than
a React rendering failure.

No project content, Photoshop document content, Adobe account data, or external
service was changed by the audit.

## Audit findings

### P0 — runtime entry and panel visibility

- A user can select AlbumAI Browser without receiving visible confirmation
  when the development plugin is unloaded or the panel is not surfaced.
- Load, reload, reopen, close, and workspace-restoration behavior need one
  explicit acceptance flow with visible success/failure feedback.

### P1 — workflow hierarchy

- The top bar combines brand, project identity, five workflow steps, Save,
  Undo, and Redo. At narrower widths the step bar becomes horizontally
  scrollable, so later steps and the active context can be missed.
- Import exposes view, folder, search, sorting, selection, culling, filters,
  project navigation, and inspector controls simultaneously. The hierarchy is
  functional but dense.
- Design presents **Build Execution Dry Run**, **Execute Replacement**,
  **Replace All**, **Process Project**, and **Render Sheet** in one action row.
  Developer/diagnostic actions compete with the operator's primary action.
- Template order, filename, readiness, movement, and removal controls need
  clearer spacing and grouping; order and filename must never visually merge.
- Recovery and execution diagnostics are valuable but can dominate the
  workspace. The normal state needs a compact summary with details available
  on demand.

### P1 — responsive containment

- The source has a 720-pixel stack breakpoint and many local overflow rules,
  but minimum, docked, floating, and screenshot-size behavior is not covered by
  one acceptance matrix.
- Nested scroll regions appear in photo/inspector and Design/execution layouts.
  Keyboard focus and the primary action must remain reachable without hunting
  across independent scroll areas.

### P2 — visual system and maintainability

- Workflow active-state styling is defined in multiple stylesheet sections,
  including later `!important` overrides.
- Significant layout styling is split between inline React styles and the
  stylesheet, making breakpoint behavior harder to reason about.
- Emoji are used as product/navigation icons. Final UI should use one approved
  icon language and the permanent logo rather than depending on platform emoji
  rendering.
- Enabled, disabled, warning, recovery, and destructive actions need one
  consistent contrast and emphasis system.

## Acceptance matrix

Every implementation slice must be checked at these panel sizes:

| Surface | Size | Required result |
| --- | --- | --- |
| Minimum dock | 320x500 | No root horizontal scroll; active step and primary action reachable |
| Preferred dock | 420x800 | Workflow context visible; inspector/details usable |
| Preferred floating | 900x700 | Stable two-pane layout without clipped actions |
| Marketplace review | 1360x800 | Final UI composition only; screenshot capture remains deferred |

For each size, verify project closed/open states, empty/populated photo library,
Import/Cull/Design/Export navigation, disabled and busy actions, long project
and template names, recovery unavailable/available/failed states, and keyboard
focus order.

## Delivery slices

1. **ALB-135.1 — audit and acceptance plan:** this record and deterministic
   planning assertions. No production UI or bundle change.
2. **ALB-135.2 — workspace shell:** simplify the header and step navigation,
   keep the active step visible, define one primary action region, and qualify
   panel load/reopen visibility.
3. **ALB-135.3 — Import, Sort, and Cull:** reduce simultaneous toolbar weight,
   group secondary filters, and preserve fast selection/inspection.
4. **ALB-135.4 — Design and execution:** separate operator actions from
   diagnostics, clarify template rows, and collapse normal recovery details.
5. **ALB-135.5 — responsive runtime qualification:** test the acceptance matrix
   in Photoshop with disposable fixtures and record final UI evidence.

### ALB-135.2 implementation progress

The first workspace-shell pass is implemented on the dedicated ALB-135 branch:

- the header uses one compact brand mark, product name, truncated project
  identity, workflow region, and action region;
- workflow steps use stable numeric/completed markers rather than platform
  emoji, with the active step exposed as text at docked widths;
- connector decoration is removed so every step has a consistent target; and
- Save remains the emphasized header action while Undo and Redo retain their
  existing behavior and disabled-state rules.

This pass does not change wizard eligibility, photo state, album state,
Photoshop execution, persistence, output, or recovery behavior. Import/Sort/
Cull screen work and the reserved Enhance step remain later slices.

#### Installed Photoshop acceptance check

After the production bundle passed, Adobe UXP Developer Tools reported AlbumAI
Pro **Loaded** and **Plugin Reload Successful**. The panel controller was then
aligned with the Manifest v5 `rootNode` lifecycle, and a clean unload/load
reported **Plugin Load Successful**. Runtime inspection confirmed a 900x700
panel document containing the new `albumai-workspace-layout`, product header,
and workflow shell. No application exception was reported during load.

In Photoshop 2026, **Plugins > AlbumAI Pro > AlbumAI Browser** remained
available. **Bring All to Front** alone did not reveal it. After the
user-approved **Window > Workspace > Reset Essentials** action, selecting the
panel added it to the secondary dock; expanding that collapsed dock surfaced
the AlbumAI Browser visibly in the primary workspace. This resolves the panel
visibility diagnosis and provides visual runtime evidence for the installed
bundle. ALB-135.2 remains open only for inspecting the project workspace shell
at the acceptance sizes. No project content or Photoshop document content was
changed during this check.

#### Docked workspace-shell qualification

Opening the existing REC005 test project exposed a UXP-specific layout defect:
the new header DOM was present, but its CSS Grid box measured 0x0 while the
legacy workspace content below remained visible. The header was changed to a
non-shrinking, wrapping flex layout and the production bundle was rebuilt and
reloaded successfully.

Developer Tools measured the live panel document at **420x675**.
At the live 420-pixel Photoshop dock width, the corrected header visibly shows
the compact AlbumAI mark and name, Save, Undo, Redo, and the active **Step 1 of
5 · Import** context without root horizontal scrolling. The existing project
content remains usable below it. This qualifies the preferred dock shell
behavior. Photoshop did not allow the dock divider to contract below this live
width, so the 320x500 visual check remains environment-limited rather than
failed. A controlled floating-panel drag again moved the panel outside the
captured primary workspace, so the 900x700 visual check remains open; Reset
Essentials restored the project panel to its visible docked state afterward.

### ALB-135.3 implementation progress

The first Import/Sort/Cull density pass keeps the frequent controls—view,
folder, search, base sort, selection, culling decisions, auto-pick, and
comparison—directly available. Type, rating, orientation, favourite, and
duplicate controls now live in one collapsed **Filters** disclosure. Its label
shows the number of active secondary filters, and an active filtered state can
still be reset without reopening the disclosure.

This is a presentation-only reorganization: existing query behavior, saved
photo-browser preferences, culling decisions, duplicate analysis, selection,
and keyboard controls remain unchanged. Persistent manual drag ordering and
per-camera clock correction are now implemented; operator-authored event
chapters and the optional future AI story draft remain the next Sort-workbench
units.

The production bundle reloaded successfully in UXP Developer Tools. In the
live 420-pixel Photoshop dock with the six-photo REC005 fixture, the compact
Filters control was visible beside the culling actions, expanded to reveal the
secondary controls, and collapsed back to the default state without changing
the loaded project, photo count, or selection.

#### Persistent manual story order

The next Sort-workbench unit adds **Manual Order** as an explicit sort mode.
The operator may begin with Name, Date Taken, or another deterministic base
sort, then drag a thumbnail or list row onto another photo to move it in the
story. The first move activates Manual Order and saves a path-free ordered list
of stable photo keys in project metadata. Reopening or refreshing the project
reconciles that order: unavailable photos are removed and newly imported photos
are appended without mutating the source photo records.

Manual reorder is intentionally disabled while search, metadata, culling, or
event filters hide part of the library; the UI asks the operator to clear those
filters before changing the full story. Switching back to Date Taken or another
automatic sort does not destroy the saved manual order.

Live Photoshop runtime verification on 2026-09-01 confirmed that a six-photo
project saved `sort.field = manual` with six path-free `p1-…` story keys, and
that Manual Order plus all six photos restored after a plugin reload and project
reopen. The desktop automation driver does not synthesize UXP's HTML5
`DataTransfer` payload, so the physical drag gesture remains an operator smoke
check; deterministic move, reconciliation, immutability, and persistence paths
are covered by the ALB-060 and ALB-135 regression suites.

#### Per-camera clock correction

The Sort workbench now exposes **Camera Times** without changing the original
files. JPEG EXIF inspection publishes camera make/model with Date Taken, the
browser groups photos by stable normalized camera identity, and the operator may
enter a signed correction in whole minutes for each camera. The UI states the
direction explicitly: a camera that is eight minutes slow receives `+8`.

Corrections are bounded to seven days, normalized into project metadata, and
reconciled against cameras still present in the library. Corrected timestamps
are in-memory projections used by Date Taken sorting and event grouping; source
photo records and JPEG metadata remain untouched. Reset all removes every saved
correction. Missing camera EXIF is handled as one visible **Primary Camera**
group so the deterministic/manual workflow remains available.

Future AI story drafting may consume corrected time as supporting evidence, but
visual/location/outfit/event evidence remains necessary and the proposal stays
review-only.

Live Photoshop runtime verification on 2026-09-01 used the six-photo REC005
fixture in the compact dock. Camera Times opened without hiding its guidance or
input, a `+8` minute Primary Camera correction saved as one normalized project
metadata item, and both the active-count badge and value restored after plugin
reload plus project reopen. The source JPEGs were not written or renamed.

#### Manual event chapters

The Sort workbench now supports operator-authored **Event chapters** alongside
automatic time groups. An operator can select photos, create an event, rename
it, move it earlier or later in the wedding story, and move another selection
into it. Creating the first manual chapter switches the event strip to the
reviewed manual sequence; before that, automatic time groups remain available.

Chapter membership uses the same path-free stable `p1-…` photo identities as
manual story order. A photo belongs to at most one manual event, stale photo
memberships are removed when the library changes, and empty named chapters are
retained. The normalized model is immutable, limited to 200 chapters, and saves
under `photoEventChapters` in project metadata. Source photos, EXIF, and folder
order are never modified.

This completes the first manual event-sequencing foundation. Future AI event
drafting can propose chapters using corrected time plus scene, location, people,
and outfit continuity, then write into the same reviewable model without
replacing the deterministic/manual path.

Live Photoshop runtime verification on 2026-09-01 used the six-photo REC005
fixture in the compact dock. Two chapters were created, renamed to **Reception**
and **Ceremony**, reordered, and displayed in the same order in the event strip.
After plugin reload and project reopen, both names, the order, and the six-photo
Reception membership restored from project metadata. The fixture intentionally
retains these two review chapters as runtime evidence.

#### Multi-photo story moves and session undo

Manual Order now treats the current selection as a movable story block. When
the dragged photo is part of a multi-selection, every selected photo moves
together to the drop target while retaining its existing internal order. If the
dragged photo is not selected, the operation remains a single-photo move; a
drop onto another member of the moving selection is a safe no-op.

The Manual Order banner provides **Undo**, **Redo**, and **Reset**. Undo/Redo
retain up to 50 editing steps for the current project session and persist each
restored order immediately. Reset is also undoable and rebuilds the manual
sequence from ascending corrected Date Taken, so per-camera clock corrections
remain respected. The saved current order stays path-free and restores across
project reopen; the temporary undo stack intentionally starts fresh after a
reload or photo-library change.

Live Photoshop runtime verification on 2026-09-01 confirmed that the compact
panel shows Undo, Redo, Reset, and Use Date Taken without clipping. Selecting
all six REC005 photos changed the guidance to **move all 6 together**; Reset
safely remained a no-op because the saved manual sequence already matched
corrected Date Taken. The desktop automation driver still cannot synthesize
UXP's HTML5 `DataTransfer` payload, so the physical block drag remains an
operator smoke check while deterministic block movement, no-op, immutability,
and persistence paths are covered by ALB-060 and ALB-135.

To preserve the existing 740 KiB release ceiling, this unit also removed
unreachable legacy `photo-thumbnail-card`, wizard connector, and wizard banner
styles. The active `modern-studio-card` and current workspace controls were
visually rechecked in Photoshop after that cleanup.

#### Unassigned-photo review and chapter membership

Manual Event chapters now expose assignment completeness directly in the Sort
workbench. The chapter panel reports assigned and unassigned totals, while
**View Unassigned** filters the grid to photos still outside every manual event.
**Select Unassigned** opens the same review and selects that complete set for a
one-click move into any chapter through its existing **Add selected** action.
The event strip also keeps a dedicated Unassigned count visible, so missing
story membership cannot be mistaken for a complete reviewed sequence.

**Remove selected** reverses a manual membership without deleting, renaming, or
reordering a chapter. Removed photos return to Unassigned in their current
library/story order. The operation reuses normalized `p1-…` identities, retains
the one-photo/one-chapter invariant, saves through `photoEventChapters`, and
does not write source files or EXIF metadata. Empty named chapters remain valid
for a story structure that the operator intends to fill later.

#### Safe chapter lifecycle editing

Each chapter row now has two bounded structural actions. **Delete empty** is
enabled only when the chapter has no photo membership; a non-empty delete is
rejected by both the UI and immutable domain helper. **Merge ↑** combines the
current chapter into the immediately preceding chapter, retains the preceding
chapter's identity and name, appends the source membership in reviewed order,
and then removes only the source chapter.

Merge runs through the same normalizer as every other manual-event mutation,
so it cannot lose or duplicate photo keys and the one-photo/one-chapter rule
remains enforced. The merged destination becomes the active event for immediate
review, while the persisted `photoEventChapters` snapshot remains path-free and
source photos stay untouched.

This completes the deterministic manual Sort foundation before future AI event
proposals are introduced. The next bounded workflow unit is a clear Sort
completion check and safe handoff into Cull, including an explicit warning when
manual chapters still contain unassigned photos.

The production bundle was reloaded through Adobe UXP Developer Tools with
**Plugin Reload Successful** on 2026-09-01. The desktop driver could not surface
the docked UXP panel after that reload, so no fixture chapter was merged or
deleted and no unsupported visual-runtime claim is recorded. Delete/merge
behavior is covered by immutable ALB-071 domain tests and ALB-135 render-contract
checks; a physical compact-dock click-through remains an operator smoke check.

The ALB-130/131 historical size assertions now inspect the immutable v1.2.0
bundle inside its published release ZIP instead of incorrectly measuring the
active v1.2.1 development bundle. The current candidate still retains its own
740 KiB ceiling through ALB-129.

## Approved product-workflow foundation

The pre-implementation prototype review selected one progressive six-step
workflow: **Import → Sort → Cull → Enhance → Design → Export**. The steps are
operator checkpoints, not six mandatory manual jobs. A future automatic path
may prepare a reviewable draft across multiple steps, while every decision
remains editable and the existing deterministic/manual path stays available.

### Story ordering and multi-camera work

- Sort must support an automatic base order followed by persistent visual
  drag/reorder of one or multiple photos, with Undo, Redo, and reset.
- Multi-camera timestamps are supporting evidence only. The workflow must allow
  per-camera clock offsets and must not assume EXIF dates are correct.
- The non-AI path must let the operator create, rename, reorder, and review
  event chapters from the beginning to the end of the story.
- A future AI-assisted draft may use location/scene changes, bride/groom and
  outfit continuity, ceremony/event cues, visual continuity, and timestamps.
  Its output is a proposal; it cannot lock order, reject photos, or start a
  Photoshop mutation without explicit review and approval.

### Editing and album design provisions

- Enhance reserves a non-destructive review surface for future color grading,
  portrait retouch, background extension, and object removal. Originals remain
  unchanged; manual controls and reset remain available.
- Design reserves a reviewable album-structure draft covering page count,
  cover, wrapper, index, story spreads, template/slot matching, crop, and
  typography.
- Approved PSD templates remain the deterministic design source and fallback.
  Future generated layouts are an optional, separately qualified source rather
  than a prerequisite for the workflow.
- Future AI integration remains capability-gated by ALB-070. Prototype labels
  and reserved controls do not constitute model integration or a shipped AI
  claim.

## Safety and scope boundaries

- No feature behavior, project schema, output transaction, or recovery policy
  changes in ALB-135.1.
- No permanent logo decision and no final Marketplace screenshots in ALB-135.
- The temporary Option 3 icon remains test-only candidate artwork.
- ALB-134 stays open; its screenshot, logo ownership, CCX, and runtime-smoke
  blockers are not cleared by UI planning.
- No Adobe Console upload, submission, publication, Git tag, or GitHub release.
- The published `v1.2.0` tag and artifacts remain immutable.
