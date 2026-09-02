# AlbumAI Library Prototype Handoff

## Purpose

Complete and approve the Photos → Library experience in an interactive HTML prototype before changing production plugin code again.

The tracked demo imagery is an AI-generated contact sheet of fictional adults created specifically for public prototype use. Private local test photos are ignored and must never be committed or uploaded.

## Product shell

- Main workflow: Photos → Enhance → Design → Export
- Photos workflow: Library → Sequence → Album Selects
- Current implementation scope: Library only
- Sequence and Album Selects remain visible but locked until Library approval

## Library interaction contract

1. Folder controls
   - Add Folder
   - Change Folder
   - Refresh Folder
   - Optional subfolder import is provisioned
2. Dynamic facets
   - Events detected from imported photos
   - Cameras detected from metadata
   - Photo types detected from analysis
   - Click again resets a single facet to All
   - Ctrl/Cmd-click combines several facet values
   - Event targets accept dragged photos
3. Photo decisions
   - Hover controls: Keep and Reject
   - Keyboard: K and R
   - Repeat the same decision to clear it
4. Star ratings
   - Keyboard 1–5 assigns that rating
   - Keyboard 0 clears the rating
   - Repeating the current rating clears it
   - Filter comparison supports =, ≥ and ≤
5. Color labels
   - Keyboard 6, 7 and 8 assigns red, yellow and green
   - Keyboard 9 clears the label
   - Repeating the current label clears it
   - Applied label remains visible as a thumbnail border
6. Selection and navigation
   - Click selects one photo
   - Ctrl/Cmd-click toggles photos
   - Shift-click selects a range
   - Ctrl/Cmd+A selects all currently visible photos
   - Arrow keys navigate and keep the active photo visible
   - Shift+Arrow extends the selected range
7. Quick preview
   - Hold Space to show a bounded preview inside the plugin surface
   - Release Space to close it
   - Filename, event, camera and rating appear with the preview
8. Views and search
   - Grid and List views
   - Filename search
   - Manual, filename, capture-time and rating sort options
9. Persistent information
   - Inspector preview and metadata
   - Results, Selected, View and Sort status remains visible
   - Rating and color state remains visible without hover
10. Safety and history
   - Undo and Redo for decisions, ratings, labels and event changes
   - Save action is explicit

## Approval checklist

Cloud QA completed 2026-09-02. All gates are implemented and ready for owner approval; checkboxes remain open until approved by the owner.

- [ ] Visual hierarchy and spacing — QA pass
- [ ] Smooth hover without flicker — QA pass
- [ ] Fast arrow-key navigation — QA pass
- [ ] Bounded Space preview — QA pass
- [ ] Selection and multi-selection — QA pass
- [ ] Keep/Reject — QA pass
- [ ] Star ratings — QA pass
- [ ] Color labels and filters — QA pass
- [ ] Dynamic facets and multi-photo event assignment — QA pass
- [ ] Responsive layouts — QA pass

Production implementation remains blocked until all ten Library gates are owner-approved.

## Repository checkpoints

- Stable feature checkpoint: `feature/alb-136-photo-workflow-ui` at `fd90977`
- Experimental direct-plugin checkpoint: `backup/alb-136-direct-library-ui-20260902` at `6926791`
- Main and release branches are unchanged

## Cross-computer continuation prompt

Use this prompt in a new task after the prototype branch is pushed:

> Continue AlbumAI Library prototype from branch `prototype/albumai-library-ui`. Read `prototypes/library/README.md` first. Do not modify production plugin code until the Library approval checklist is complete.

## Cloud plan

1. Push the two safety branches to GitHub.
2. Create `prototype/albumai-library-ui`.
3. Store the prototype, assets and this handoff file under `prototypes/library/`.
4. Publish only that folder through GitHub Pages after the prototype branch is ready.
5. Continue from any computer by opening the same GitHub repository and using the continuation prompt above.
