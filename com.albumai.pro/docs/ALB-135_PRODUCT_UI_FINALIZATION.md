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
and keyboard controls remain unchanged. Persistent manual drag ordering,
per-camera clock correction UI, and the optional future AI story draft remain
the next Sort-workbench units.

The production bundle reloaded successfully in UXP Developer Tools. In the
live 420-pixel Photoshop dock with the six-photo REC005 fixture, the compact
Filters control was visible beside the culling actions, expanded to reveal the
secondary controls, and collapsed back to the default state without changing
the loaded project, photo count, or selection.

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
