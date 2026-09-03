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
   - Cameras detected from metadata and assigned stable color identities C1, C2, C3…
   - Camera colors live in the Cameras facet; Add / align camera is available for metadata or clock corrections
   - The camera tag automatically supplies the light thumbnail-information tint and the sortable List camera tag
   - Photo types detected from analysis
   - Click again resets a single facet to All
   - Ctrl/Cmd-click combines several facet values
   - Event targets accept dragged photos
3. Photo decisions
   - Every imported photo is Included by default; only rejected photos carry an explicit decision
   - Reject toggles to Unreject and restores the photo to Included
   - Review toolbar filters: All, Included and Rejected
   - Favorite is an independent heart state, separate from rejection
   - Hover control and keyboard F toggle Favorite
   - Favorites-only filter is available in the review toolbar
   - Hover and List controls expose Reject / Unreject only
   - Keyboard R toggles Reject / Unreject
4. Star ratings
   - Review Filters presents Exact, At least and At most as named controls
   - Rating choices show live photo counts before filtering
   - The active filter summary and one-click Reset prevent hidden filter states
   - Keyboard 1–5 assigns that rating
   - Keyboard 0 clears the rating
   - Repeating the current rating clears it
   - Filter comparison supports =, ≥ and ≤
5. Camera identity tags
   - Camera color tagging is automatic rather than a manual photo rating
   - Each detected camera receives a stable C1, C2, C3… tag and distinct professional color
   - Grid thumbnails use a light full-width camera tint below the image, with a slim color anchor at the bottom
   - List view shows a compact C-number tag in the Camera Tag column
   - Manual color-label filters and Approved / Review / Select workflow names are removed
6. Burst Review
   - The demo contains four genuine same-moment burst groups across three cameras: Bride Aisle, Ring Exchange, Family Group and Reception Dance
   - Each demo group contains six consecutive frames; the production rule supports groups of five to eight frames from one camera
   - AlbumAI automatically includes one strongest AI frame per group and classifies every unselected frame as a Burst Duplicate in Rejected
   - Manual Review provides a large preview for every frame and allows one or more photos to remain selected
   - Selecting an additional frame immediately includes it; deselecting it returns it to Rejected
   - At least one photo must remain selected in every burst group
   - Reset to AI Pick restores the original recommendation and automatic duplicate rejections for that group
   - Needs review and Reviewed counts operate across all four groups within Photo type
   - Needs Review groups use amber status styling; completed groups change to green Reviewed only after Apply Review
   - The polished review workspace pairs a large active-frame preview with right-side EXIF-style details
   - The active frame stays contained in a fixed, scrollbar-free preview stage across portrait and landscape screen proportions
   - Fit, zoom out and zoom in controls enlarge the preview without changing the modal layout
   - Clicking a burst thumbnail updates the large preview; the redundant per-thumbnail Preview button is removed
   - Left / Right keys and visible side controls navigate the burst frames and keep the active thumbnail visible
   - EXIF details show the camera's C-tag color and the current rating as filled and empty stars
   - Burst frames use a dedicated horizontal thumbnail strip with a sleek hover-only grey scrollbar
   - Keyboard V opens Burst Review
7. Selection and navigation
   - The persistent top-right checkbox is the only pointer control that selects or unselects a photo
   - Clicking a thumbnail changes only the active Preview / Inspector photo and never changes the selected set
   - Checkbox clicks accumulate a persistent multi-selection; clicking a checked box unselects that photo
   - The bottom hover review bar places circle-slash Reject left of the stars and Favorite on the right; it never obscures the top-right checkbox
   - Actions on an unselected photo affect only that photo without silently selecting it; actions on a selected photo apply to the selected set
   - Ctrl/Cmd+A selects all currently visible photos
   - Arrow keys move active focus without clearing checkbox selections and keep the active photo visible
   - Shift+Arrow extends the selected range; Ctrl/Cmd+Arrow toggles the focused photo in the selection
8. Quick preview
   - Space toggles a bounded Bridge-style preview inside the plugin surface; Escape also closes it
   - With no checked photos, Space previews the current filtered Library from the active thumbnail
   - With one or more checked photos, Space previews only that checked queue without selection overlays
   - After Ctrl/Cmd+A, the preview queue contains all selected visible photos
   - Arrow keys and visible Previous / Next controls navigate the queue
   - Keyboard 1–5 rates the current preview photo; 0 clears its rating
   - Keyboard F and the visible Favorite button toggle Favorite for the current preview photo
   - Preview rating and Favorite never apply accidentally to the whole selected queue
   - Filename, queue position, event, camera and rating remain visible with the preview
9. Views and search
   - Grid and List views
   - Bridge-inspired compact grid, detailed list columns and bottom thumbnail-size control
   - Filename search
   - Manual, filename, capture-time, rating, camera-tag, type, size and dimensions sort options
   - List headers sort by Name, Date Created, Size, Type, Rating, Camera Tag and Keywords; repeat click reverses direction
   - List rows are editable for Favorite, Reject/Unreject and 0–5 stars, including multi-selection and Undo/Redo
   - List column headers remain frozen while rows scroll
   - Internal scrollbars stay hidden until hover, then appear as slim neutral-grey controls
10. Persistent information
   - Bridge-inspired Preview panel, metadata summary and collapsible File Properties
   - Results, Selected, View and Sort status remains visible
   - Rating, rejection and automatic camera identity remain visible without hover
11. Safety and history
   - Undo and Redo for rejection, ratings, favorites, burst choices and event changes
   - Save action is explicit

## Approval checklist

Cloud QA completed 2026-09-02. All gates are implemented and ready for owner approval; checkboxes remain open until approved by the owner. Favorite and star-rating polish, automatic camera identity tags, simplified Reject/Unreject decisions, the Adobe Bridge reference pass and four-group guided Burst Review are implemented after owner feedback.

- [ ] Visual hierarchy and spacing — QA pass
- [ ] Smooth hover without flicker — QA pass
- [ ] Fast arrow-key navigation — QA pass
- [ ] Bounded Space preview — QA pass
- [ ] Selection and multi-selection — QA pass
- [ ] Reject/Unreject — QA pass
- [ ] Star ratings — QA pass
- [ ] Automatic camera tags and filters — QA pass
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
