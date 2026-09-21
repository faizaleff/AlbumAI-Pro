# Design, batch and export priority — 2026-09-14

## User direction

Finish Design, batch processing and Export before returning to Sequence or Library polish. Temporarily treat every photo without a Library Reject decision as a final photo. Browser highlights remain temporary interaction state. Keep the UI simple; consider current Photoshop/AI facilities where supported and useful.

## Implemented first pass

- Canonical Library decisions now provide Design eligibility. Manual placement has its own final-photo picker; Arrange uses all eligible photos. Album requests no longer depend on browser highlights. A rejected or missing assigned photo blocks that sheet before Photoshop execution.
- Added a deterministic arrangement path preserving the supplied library order. It consumes only photos actually assigned, preventing skipped photos when a requested three-photo chunk meets a two-slot template. It does not invent a new Sequence, regroup events, or auto-approve incomplete layouts. Empty final slots still require manual resolution.
- Main Design keeps template setup/text available and collapses legacy dry-run, processing and output toggles under Advanced tools. Spread identifiers are generated; manual ID fields are removed from the main flow.
- Simplified Arrange to photo count, density, preview count and create/add/replace actions. Failed persistence leaves the dialog open with an error.
- Export now offers the actual editable PSD copy plus JPEG path, at PSD template dimensions/resolution. Removed production controls that advertised PDF creation, watermarking or print resizing although those options never reached a file-producing implementation. Existing pure calculation/manifest helpers remain for future work; they are not a PDF exporter.
- Export preflight rejects missing templates, rejected/missing photos, invalid/duplicate slots and unfilled slots. A real renderer still revalidates templates and photo eligibility before execution.
- Album export retains one owner across all spreads, locks album changes and competing processing, forces Save Copy even if legacy Auto Save was configured to overwrite, and reports actual progress/results. Cancellation stops the outer album queue as well as requesting a safe stop from the active template. Failed/stopped work cannot report full success.
- Existing single-template transaction/recovery and collision-safe naming remain in use. This pass does not implement durable resume of the entire multi-spread album queue; rerunning Export all starts a new full run.

## Current Adobe feature review

Checked official Adobe sources on 2026-09-14:

- [Photoshop August 27 updates](https://blog.adobe.com/en/publish/2026/08/27/new-photoshop-innovations-bring-you-more-choice-control-at-every-stage-of-your-creative-process): Light Adjustment Layer, Instruct Edit with Masks, Dynamic Text on paths and the beta AI Assisted Editor. Availability in Photoshop does not by itself establish a public plugin automation contract.
- [Photoshop API changelog](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/changelog/) and [Generative Upscale options](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/objects/generativeoptions/generativeupscaleoptions): a documented optional upscale path exists. Candidate for low-resolution source repair, with feature detection and explicit user invocation; never automatic alteration of original wedding photos or every batch output.

No AI editing call, model download, cloud upload, host upgrade or new permission was performed. AI editing integration is still pending capability/host acceptance; there is no claim that the newest features are already included.

## Remaining before declaring the workflow complete

1. Native disposable-project run: final photos → arrange → manual assignment/crop/swap → save/reopen → editable PSD copies + JPEG outputs. Verify actual output dimensions, color, ordering, missing/duplicate output behavior and original-file integrity.
2. Native cancellation, failure/retry and reopen recovery across multiple spreads. Extend durable album-level resume so successful spreads are not repeated after a restart.
3. Verify the simplified main Design workspace in Photoshop; qualify optional Photoshop AI actions independently.
4. If PDF proof or explicit lab-size output is required, implement a real file-producing path and verify it before restoring its controls.

Computer-use inspection can read the current Photoshop panel, but clicking Design fails with `noWindowsAvailable`. The live plugin was not reloaded over the user's current project. This is a concrete host-acceptance blocker, not a completed end-to-end test.

No commit, push, merge, package or version change in this pass. Existing uncommitted Library/verification work was preserved.

## Validation of this pass

All test suites in the full `verify` invocation passed. That invocation then stopped on the expected test-import graph count after the new direct Design UI test made four additional modules reachable without the legacy baseline test. The count was updated (134 reachable / 10 legacy gap); regression verification then passed with 1367 assertions and all 144 active files reached. Hardening, production build, bundle, typography readiness, distribution inspection and diff checks also passed after the final changes.

Relevant suite results: Design 130 assertions; Arrange 66; print/export 41; album batch 78; multi-template layouts 182; sheet render bridge 38; album domain 23. These are automated/mock and static-render checks, not native Photoshop qualification.

Final bundle: 771482 bytes; SHA-256 `950773cff4c7854d7cd1c49a2732a1a66bff1453a2b2eaf77f45d06899210226`. The existing 763 KiB development ceiling remains unchanged in this pass.


## Three-column Design workspace — follow-up

Implemented the user-approved layout in the existing Design entry point:

- Left: Photos / Templates tabs, searchable final photos, All / Unused (across every spread), bounded 40-photo pages, chosen template for the next spread, existing registration and Advanced tools. The panel can collapse.
- Center: selected spread, large selectable photo slots, Photoshop render action and a fixed horizontal spread thumbnail strip. Add spread now creates a spread immediately; the previous strip merely prepared an ID. Canvas content scrolls independently.
- Right: spread name and ordering/duplicate/remove actions; contextual photo placement/replacement, crop focus, swap and removal; existing text controls moved using a portal so a single TemplateDocumentPanel controller owns them. The panel can collapse.
- No invented slot IDs in the new workspace. A missing template does not silently substitute the first registered template. The registry currently persists slot IDs/names but not PSD geometry; the center is explicitly a **photo slot overview**, not a pixel-accurate PSD canvas. Photoshop remains the actual layout/crop reference.
- All new album actions use the existing persisted mutations/undo pipeline and processing lock. Browser highlights do not change final-photo eligibility.

Validation: full `npm run verify` passed after the main implementation, including all suites, architecture, regression, hardening, production build and bundle checks. Following image-container and typography composition cleanup, the relevant Design suite passed (144 assertions), production build, bundle inspection and distribution inspection passed, and `git diff --check` was clean. No budget or version change.

A local interactive preview uses the real DesignWorkspace/SheetStoryboardStrip and album mutation domain with detached sample state and previously generated local comparison thumbnails. It makes no network requests and does not touch the user's project. Photoshop-only actions are clearly labelled as unavailable in the preview. File: `/Users/eff/.codex/visualizations/2026/09/10/01a08c30-e038-78a0-a1f1-d6c865ac453e/albumai-design/index.html`.

Browser automation refused to open the local preview under its URL security policy. No alternate browser/localhost workaround was attempted. Thus responsive visual checks, interactive browser acceptance and native Photoshop layout/text/scroll checks remain unverified. The preview is available for the user to open manually; do not call this a screenshot or native Photoshop proof. The plugin has not been reloaded over the active user project.


## Native acceptance attempt — current follow-up

User explicitly authorized starting the Photoshop end-to-end test. Fresh Photoshop screenshot shows the previous single-scroll Design UI on `ALB045-RT01-Project`, so the new three-column build is not loaded yet. Attempting the plugin Save button failed with computer-use `noWindowsAvailable`. The Window menu can be accessed through AX, but opening New Document produced a dialog with no available screenshot/usable controls; it was dismissed without creating/saving a document. No user project, template or output was changed, and no reload was attempted before saving.

Requested the user to save the plugin project and Reload AlbumAI Pro in UXP Developer Tool, then bring Photoshop forward. This is a host-control assistance request, not a new permission/approval request. The UXP CLI is not available on PATH; the connected Adobe tools expose cloud editing, not a local Photoshop plugin test bridge.

Prepared 12 hash-verified copies of existing reduced local comparison JPEGs under `/private/tmp/albumai-design-qa-20260914/photos`. The accompanying `input-manifest.json` records fixture hashes and the two-spread native acceptance checks. Native run status remains **NOT RUN**. After host control is restored, use a separate QA project and copied six-slot PSD; do not replace the user's current album with the fixture.


## Native follow-up after user confirmation — 2026-09-14

This section supersedes the earlier host-control status above.

- Successfully clicked Save and Close on `ALB045-RT01-Project`; native UXP logs confirm the metadata commits. The original album was saved before reloading.
- Created a separate project through the native plugin at `/private/tmp/albumai-design-qa-20260914/AlbumAI-Design-QA-20260914`. Copied the existing six-slot `TES PSD 04.psd` into its Templates directory and verified the source/copy hashes. The twelve reduced JPEG fixtures remain in the sibling `photos` directory. They have not yet been imported or arranged; no output was produced.
- Found the workflow header clipped in an 889px native window. Added a wrapping Design/Export header with a full-width workflow row at narrow widths. Relevant Design tests passed (144 assertions) and production build passed; the revised header still needs native visual confirmation.
- Added a regression reproducing a detached React root after `create(host) → hide() → show()` with no new DOM argument. The test failed against the prior controller. The fix remembers the latest host across hide/show, handles non-DOM lifecycle arguments, and preserves the existing React tree until destroy. The 12-assertion ALB-051 suite now passes. This proves the lifecycle bug and fix in the regression harness; it does not establish the cause of the native capture problem.
- UXP Developer Tools reported Plugin Reload Successful after the rebuilt bundle. Computer-use still exposes only the Photoshop main window and collapsed AlbumAI dock icon; opening the plugin menu or dock icon did not expose usable panel controls. No runtime exception was found in the inspected UXP log. Native placement/crop/swap, output verification and original-project reopen could not be completed. Do not mark batch/export acceptance complete.

Latest build: 773951 bytes, SHA-256 `3c3dc362645a6527f706386e62a8182b909d65290142f274786c1816b481e1c4`. Version remains 1.2.0; no commit, push, merge or package.

Final verification after the lifecycle fix: `npm run verify` completed with exit 0 (all configured suites, architecture/regression/hardening checks, production build, bundle and typography verification). `git diff --check` passed. These remain automated checks; native output acceptance is pending as stated above.


## Loaded-template screenshot correction — 2026-09-14

User screenshots confirm the native three-column Design UI and wrapped header are visible. The computer-use screenshot is capturing a different Photoshop surface, so its absent panel must not be taken as proof of plugin failure. User opened the QA project, imported all twelve photos, opened the copied PSD and registered it. Persisted registry is READY with **seven** canonical slots (22, 19, 20, 17, 50, 23, 21), correcting the earlier six-slot assumption. Two persisted spreads exist, both still unassigned. Native exports remain untested.

The loaded PSD screenshot exposed leftover JSX fragments and a duplicate ManualTypographyPanel in the document-details branch. Removed that leftover block, retaining one shared editor or one portal. Added a loaded-template hook regression that opens a fixture through Open PSD and checks visible text, a single editor and portal destination in both modes; it failed on the prior code and passes with the fix. Design suite now passes 151 assertions. All smart-typography suites, production build, bundle and diff checks pass. UXP Developer Tools reported Plugin Reload Successful for the corrected build.

Current bundle: 773574 bytes; SHA-256 `ec6c3ac58f6a5a5c4ece8d9dbd263ee4a5bcd07f494930812a2971f7404a867e`. No commit, push, package or version change.


## Template-aware Arrange and compact setup — follow-up

The user's native Arrange screenshot showed a three-photo default on a seven-slot template, producing four unnecessarily sparse spreads. Arrange now defaults to Match template slots, derives capacity from available registered smart objects, and offers explicit counts including capacities above six. The same resolved limit feeds both preview and apply. The preview reports exact empty-slot and incomplete-spread counts; twelve photos with the seven-slot fixture yield two spreads (7 + 5), with two slots on Spread 2 requiring manual completion or a smaller template before export. Photos are neither duplicated nor dropped to fill gaps. Existing explicit density behavior remains available.

Compact Design template setup uses the existing UXP-friendly button component. The picker is constrained to the asset-pane width, the template name truncates, and reorder/remove controls wrap onto their own line so every action remains reachable. Legacy wide template controls retain native buttons.

Validation: Arrange 72 assertions; Design 151; album batch 78; regression coverage 1382 assertions, all 144 active files reached. Production build, bundle verification and diff check passed. Latest bundle 774541 bytes, SHA-256 `26e4b960a7ceb0995dbc0d034a31c8c4b8d56cc321d633e5182795b09174f0dd`. The new arrangement and sidebar need user/native visual confirmation; PSD/JPEG output qualification remains pending. No commit, push, package or version change.

Native arrangement confirmed by the next user screenshot and persisted QA `project.json`: Spread 1 has seven assignments using all seven registered IDs, Spread 2 has five assignments, and all twelve photo IDs occur exactly once across the album. This verifies arrangement/persistence for the fixture, not Photoshop rendering or export. Next acceptance step is Open in Photoshop on completed Spread 1, followed by completing/changing Spread 2 before album export.


## Native placement and crop propagation — follow-up

User screenshot shows Spread 1 rendered in the actual Photoshop 36 × 12 inch, 300 ppi template, with seven photos occupying the expected masks. UXP log reports the one-template queue completed, zero failed; autosave and export were SKIPPED, and Output remains empty. SHA-256 checks confirm both the original PSD and the QA copied PSD remain identical to the recorded fixture hash. Rendering in an open document is confirmed; saved PSD/JPEG export is not.

The screenshot also exposes clipped faces. Saved assignments already specify Top, but cropFocus was dropped in the placement/plan/request pipeline and the executor always centered replacement contents. Canonical slotBounds were also dropped between the execution plan and replacement step. The fix carries cropFocus through both single and multi-photo planning, execution plans and serialized replacement requests; it snapshots slotBounds and aligns the selected edge after fill scaling before applying the canonical mask. Fit/center modes retain centered positioning; missing/invalid crop values normalize to center.

Added a test through planner → execution plan → replacement request → executor, with a simulated Photoshop geometry adapter. It covers all five focus directions on portrait and landscape images, immutable bounds, full slot coverage/mask preservation, and per-slot focus after multi-photo slot reordering. ALB-083 now passes 187 assertions. This is automated geometry evidence; corrected native crop still needs a rerender and screenshot.

Crop follow-up verification: full `npm run verify` exited 0, including all configured tests, architecture/regression/hardening checks, production build and bundle validation. Bundle 775072 bytes, SHA-256 `c742f4db6f7cd5a8070f1a9fc5361c207a32aa85d6de1c7e0d87749489eab0e4`. No version change, commit, push or package.

Next native screenshot shows changed crops and swapped lower-right photos. Persisted assignments confirm manual edits: photo-003 uses bottom, photo-000 center, photo-005 top; photo-001 and photo-000 exchanged slot IDs. Inspecting the reduced source images explains the visible cutoffs under those requested anchors (window/empty space dominates the top of photo-005; bottom of photo-003 contains torso). This is evidence that focus changes reach native rendering, not evidence of another confirmed mask regression. Recommend center for photo-003 and photo-005, top for photo-000, then visually review. Edge anchors alone do not constitute automatic face-aware composition. No new code change from this screenshot.

Native crop review: user's next screenshot visibly restores the three previously clipped faces after the advised per-photo anchors. Manual crop propagation and swap are qualified for this fixture; no claim of automatic face-aware composition. Spread 2 remains 5/7. Prepared two additional distinct reduced comparison JPEGs (`photo-012.jpg`, `photo-013.jpg`) in `/private/tmp/albumai-design-qa-20260914/extra-photos` with hashes in `extra-input-manifest.json`, for manual placement in the remaining slots before two-spread batch export. Existing assignments and source project metadata were not edited by this preparation.


## Add Folder data-loss appearance — recovery and fix

The earlier instruction to import `extra-photos` with Add Folder was incorrect for the old implementation: AppController.importPhotos called the source-replacement service directly. The original twelve files were never deleted, but the visible library and persisted photoSource changed to the two extra images. All spread assignments/crops remained saved, and the user created Spread 3 with the two extra images. Backups before recovery are in the QA root (`project-before-folder-recovery-130646.json` and `project-before-additive-recovery.json`).

Add Folder now uses an additive transaction. It stages the new folder, combines stable file identities with the existing ordered library, persists every real folder token before publication, preserves current selection and decisions, and deduplicates repeat folder additions. Combined sources enumerate their original file entries; filenames alone are not used to merge distinct files. Refresh/reopen restore all folders, and an unresolved folder token refuses partial hydration. Change Folder retains its explicit replacement transaction. Adding is blocked during an active album batch. Save failure rolls changed metadata fields back, including fields absent before the attempt.

Validation: ALB-043 passes 17 service scenarios including addition, repeat addition, duplicate filenames in different folders, reject/rating retention, assignments/crop retention, refresh/reopen, missing token, cancellation and token/save failures. Full npm run verify exited 0 and git diff --check passed. Bundle 777125 bytes, SHA-256 `38c776ab83d153670e870b83857459f1d2bd68161f1255d145c97498da16e5c2`; version unchanged, no commit/push/package.

Native reload confirmed in UXP log at 13:16:12. Plugin is now at welcome screen. Computer-use can capture the floating panel but coordinate clicks fail with `noWindowsAvailable`; AX raise and keyboard access did not expose a working project-picker action. **Native recovery is pending user assistance**, not complete: reopen `/private/tmp/albumai-design-qa-20260914/AlbumAI-Design-QA-20260914`, then Add Folder `/private/tmp/albumai-design-qa-20260914/photos`. Under the new build that restores the original twelve alongside the existing two extra photos, with all original absolute photo IDs intact. Expect 14 photos and three existing spreads (7 + 5 + 2). Do not re-arrange/replace spreads during recovery. The temporary copies of the extra JPEGs made while considering single-folder recovery were moved to QA-root `recovery-staging`; the actual `photos` folder contains only original twelve, `extra-photos` contains the original two, avoiding duplicate copies. PSD/JPEG export qualification remains pending.

Native folder recovery confirmed: user screenshot shows All photos 14 and Results 14/14. Saved project metadata confirms fourteen photos and two source references. Album metadata is byte-value equivalent to the pre-recovery snapshot: all three spreads and their crop/slot assignments are unchanged, and all assigned photo paths exist. Recovery is complete. Next batch test preparation remains consolidating the two photos in Spread 3 into the empty slots of Spread 2, then removing the empty Spread 3 through the normal UI before exporting two full spreads. No native output export has yet been verified.

Two-spread export preparation confirmed by user screenshot and saved project: exactly two spreads with seven slots each, fourteen unique assigned photo IDs, every file available, no duplicate placement. Spread 3 removed through user UI. Actual PSD/JPEG export remains pending; next action Export album → Editable PSD + JPEG → Export all spreads.


## First native album export — visual failure found and corrected in code

User reported exported. Output has Spread_01.psd (162532857 bytes), Spread_02.psd (20138484 bytes), Spread_01.jpg (8187561 bytes), Spread_02.jpg (2926926 bytes). Both PSD headers are 10800x3600 RGB/8, both JPEGs 10800x3600 at 300 dpi. Original and QA template SHA-256 remain `5059c599ef6c94330fb87a24acbc22257d16275684b530be98f7cac5ed873eca`. Visual inspection: Spread 1 contains all seven photos, but Spread 2 contains six grey placeholders and one badly cropped photo. **Native batch export acceptance failed despite reported COMPLETED status.** Files and manifest backed up under `/private/tmp/albumai-design-qa-20260914/export-before-selection-fix`.

UXP log 13:32:33 explicitly shows second spread photos=7, selected photos=1, assignments=1, steps=1, followed by COMPLETED. PhotoPlacementEngine.photos filtered by transient Library highlight even when exact saved sheet bindings were supplied. Fixed explicit binding membership/order to use all bound photos regardless of highlight; missing bound photos throw. Added a fail-closed check for incomplete/mismatched assignment results before execution/export. Legacy non-album selection behavior is unchanged.

ALB-083 now passes 198 assertions, including highlights on either bound photo or an unbound photo, reversed input order, unchanged Library selection, missing bound photos and an injected partial assignment service. Full npm run verify exited 0, diff check passed. Bundle 777539 bytes, SHA-256 `253f7dfd0a6f197401a12c195d1047d5eb32ddaf6460d043cd174f569c59fa18`. No version/commit/push/package change. Native reload confirmed 13:38:01. User had reopened the project by the next capture; an attempted Design click was interrupted by the user changing Photoshop to the old failed PSD window, so no corrected export was triggered. Next action: Design → Export album → Export all spreads, then inspect both new JPEGs/PSDs and runtime assignment counts. Do not treat old failed outputs as qualification evidence or mark the fix natively verified yet.

Corrected native export inspected after user rerun: both JPEGs contain seven photos, no grey placeholders; both PSD headers are 10800x3600 RGB/8 and native logs at 13:38:56–13:39:02 confirm 7 assignments/7 plan steps per spread, SAVED PSD, SUCCESS JPEG, zero failures. Spread 1 JPEG is identical to earlier good output. Spread 2 now 8589337-byte JPEG and 187535164-byte PSD. Template hash unchanged. This rerun had zero transient selections; the selected-photo regression is covered by automated tests. Remaining visible composition defect: Spread 2 left two slots crop off faces with user-selected Bottom anchors for photo-013 and photo-012. Recommend photo-013 Top, photo-012 Center then rerender/export to visually verify. Structural two-spread export works; final crop approval and native cancellation/recovery testing remain pending.

Final crop rerun checked at 13:42:32–13:42:37: persisted photo-012 Center and photo-013 Top match user changes. New Spread_02 JPEG visibly restores both left-side faces; all seven photos occupy masks without placeholders. Both spreads log seven assignments, SAVED PSD and SUCCESS JPEG, zero failed. Spread_02 JPEG 8015151 bytes; PSD 183254477 bytes. Two-spread arrangement → manual crop/swap → layered PSD/JPEG happy path is now visually verified for these reduced QA fixtures. This is not a print-quality qualification of the low-resolution source previews, an automatic face-aware crop implementation, or completion of native cancellation/recovery/reopen testing.


## Exact PSD previews — 2026-09-14 follow-up

Implemented bounded session composite previews from Photoshop imaging.getPixels + encodeImageData, explicitly targeting the document ID and full document bounds (RGB/sRGB JPEG, maximum requested width 1400). Template reads capture the template before placements; successful spread execution captures after placement and typography. Center Design view defaults to the rendered composite, with Edit photos exposing the existing assignment controls. Compact storyboard uses the same rendered composite instead of a photo collage. Template cards include captured PSD previews and an Update template preview action. Update preview/Open in Photoshop explicitly disable autosave/export for preview rendering.

Cache keys separate projects, templates, spreads, assignments/crop/typography and relevant source metadata. A new render hides its earlier composite. Cancellation/failure cannot publish a partial or stale result; a superseded asynchronous capture cannot replace a newer job. Pixel buffers are disposed and the session cache is capped at 12 entries; previews are not saved into project JSON. External Photoshop edits require an explicit preview update. Session previews need regeneration after plugin reload. The render remains a reduced display preview, not a full-resolution proof.

Template-only preview reads reject an unsaved matching/owned Photoshop document before opening/closing anything, and lock competing edits until completion/failure. Template-only reads expose no ineffective Cancel button. Spread preview cancellation uses the existing batch cancellation controller. No automatic retry.

Validation: full npm run verify exited 0 after production rebuild; bundle 781240 / 781312 bytes. Added further template-preview safety checks afterward: ALB-083 passes 212 assertions, including unsaved document preservation and lock cleanup. ALB-081 passes 154 assertions, including actual composite sources in center/storyboard and stale spread invalidation. Diff check passed. Version remains 1.2.0; no commit, push or package.

Native evidence: UXP Developer Tools confirmed Reload Successful. Computer Use showed the new Design controls and pending preview state. A native Update preview run completed at 14:01:51, one template, zero failed, export SKIPPED. The Photoshop document visibly rendered. Final in-panel composite visibility is NOT yet verified: Computer Use selected the floating PSD window; after minimizing it, captures showed a white window even after the user confirmed the AlbumAI panel was open. This capture failure is not evidence of an application blank-screen bug. Need a current user screenshot of Design to confirm center and template composite visibility; do not repeat the already-qualified two-spread export solely for this check. Native cancellation/recovery qualification remains separate and pending.


### Preview unavailable — modal scope fix

The user's 14:07 screenshot confirmed a real preview failure, beyond the Computer Use capture limitation. Added diagnostic error logging; a native reproduction at 14:09:50/52 reports `PSD_PREVIEW_FAILED The requested functionality is only allowed from inside a modal scope`. The rendering pipeline succeeded, but the imaging read/encoding had been called outside Photoshop's required modal execution.

Corrected PsdPreviewStore.capture to run document pixel reading and JPEG encoding within core.executeAsModal, then publish only after successful scope completion and cancellation/job checks. Pixel disposal and fail-closed behavior remain intact. Injected the modal executor in tests and asserted both API calls happen while the scope is active; this detects the exact missing-scope regression. ALB-083 now passes 216 assertions. Full npm run verify passed; bundle 781299 / 781312 bytes, no budget increase. Diff check passed. Reused template card image styling to keep the build within its existing limit. No version/commit/push/package change.

Corrected build reloaded through UXP Developer Tools. Waiting for native preview confirmation; no export rerun requested. Imaging API reference: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/imaging/ .

Native preview confirmed by user screenshot at 14:19: the template card shows its actual empty PSD layout; center shows the rendered spread composite; both rendered storyboard thumbnails are populated. User explicitly confirms previews now show. Modal scope fix is natively qualified for this fixture. New request is Photoshop window/panel docking, separate from preview rendering.


## Direct rendered-preview photo swap — 2026-09-14

Added transparent interactive regions over the actual rendered spread. Geometry is captured with the successful composite from the canonical placement plan, preserving slot layer IDs and accounting for returned source-bound offsets and pyramid level. Regions are clipped to the composite; missing/invalid geometry and ambiguous overlaps do not guess a target. Filled slots support dragging onto another filled slot; an accepted persisted SWAP_SLOTS mutation then renders the spread again. Existing Edit photos/Swap controls and album undo remain available. Slot geometry is not edited.

The UXP mouse gesture has a movement threshold, source/target feedback, one commit per drop, and cancellation for same-slot/gap/outside drops, Escape, blur, scroll, resize, lost mouse button, stale preview, locked workspace and disposal. Clicking a region opens the photo inspector. Failed persistence never triggers rendering. Render failures retain the normal error/retry route.

Validation: full npm run verify passed after the initial implementation (including 157 ALB-081 and 219 ALB-083 assertions). Following disposal hardening and the native styling correction, ALB-081, production build, bundle verification and diff checks passed again. Final bundle 784626 bytes; SHA-256 eb61618495f803761709c10a56e234e732b1a32ba7f417ccbe7295d009ca04f1. Explicit development bundle ceiling increased from 763 to 768 KiB for this feature (5 KiB allowance; 1806 bytes headroom). Matching release-check envelopes adjusted; no minifier/dependency change, version bump, packaging, commit or push.

Native evidence: Computer Use captured AlbumAI Design with rendered spread and aligned interactive regions after the user reopened the QA album and updated its preview. Native HTML buttons painted white ovals over the image, so the final build uses the existing transparent SidebarButton div control instead. UXP Developer Tools confirmed final Plugin Reload Successful. CUA actions on the panel intermittently fail with noWindowsAvailable or a changed-window warning; an actual native drag/drop commit was NOT verified. The persisted QA album compared unchanged with /private/tmp/album-preview-drag-before.json after the attempted drag. Final native styling and one direct swap/automatic refresh still need confirmation after reopening the existing QA project. Do not repeat the already qualified full normal export workflow for this feature.


## Manual in-slot position and zoom — 2026-09-14

User requested clicking photos in the actual preview and manually moving/zooming their contents. Added separate Move/Swap modes (Move is the default). Move drag commits slot-relative displacement on mouse release and then refreshes the actual Photoshop composite. The Photo inspector includes four 2%-of-slot nudges, zoom out/in in 10% increments (100–300%), and Reset position & zoom. This is release-to-render interaction, not a continuously rendered Photoshop image during the drag. Existing crop focus presets reset manual position, and saved manual values flow through album normalization, history, request validation, placement plan, replacement request and Photoshop transforms. Stale render requests compare position as well as focus/photo identity. Swaps carry framing with the photo. Slot geometry stays fixed; host translation is clamped to maintain fill coverage.

Verification: ALB-081 161 assertions; ALB-083 231 assertions. Added coverage for position/zoom round-trip, undo/reset, pan distance and outside-drop cancellation, planner/request propagation, actual executor scale/translation and no exposed gaps on portrait/landscape slots. Full npm run verify completed successfully, including final production/bundle validation. Final runtime 787244 bytes, SHA-256 06bbfd48745f2ad1245193dec4de84867d29c353d7073e8b6ffce533b5284372. Explicit cap increased from 768 to 770 KiB (2 KiB allowance for this feature); 1236 bytes headroom. Version unchanged; no commit/push/package.

UXP Developer Tools confirmed Plugin Reload Successful. Computer Use again captured the underlying PSD rather than the docked panel; clicking the visible plugin icon did not expose controllable panel content. Native end-to-end pan/zoom appearance remains unverified after reload. Reopen the existing QA project, enter Design, update preview, and verify a move/zoom/reset when the user is ready. Preserve the user's current three-spread album; do not restore earlier two-spread QA snapshots.
