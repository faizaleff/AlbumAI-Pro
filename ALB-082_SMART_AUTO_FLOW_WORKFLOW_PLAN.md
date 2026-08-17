# ALB-082: Smart Auto-Flow Engine & Chronological Burst Placement

## Executive Summary
ALB-082 implements an automated layout generation engine (**Smart Auto-Flow**) that partitions photos into temporal event chapters, preserves rapid burst sequences, matches photo orientations/aspect ratios to template slots, assigns high-quality hero photos to prime slots, and creates canonical Album Sheet spreads atomically with full 1-click Undo/Redo snapshot history.

---

## Key Features & Capabilities

### 1. Auto-Flow Layout Engine (`PhotoAutoFlowEngine.js`)
- **Strategies Supported:**
  - `CHRONOLOGICAL_BURST`: Groups photos chronologically into chapters and keeps burst shots together on the same spread.
  - `HERO_DYNAMIC`: Automatically identifies standout high-rank/high-sharpness photos and gives them dedicated single-photo hero spreads.
  - `BALANCED`: Distributes photos evenly across registered PSD templates.
- **Source Filtering:**
  - `KEPT_ONLY`: Auto-flows only culled `KEEP`/`KEPT` photos.
  - `SELECTED_ONLY`: Uses photos currently selected in the browser grid.
  - `ALL_PHOTOS`: Uses all photos (excluding `REJECT`/`REJECTED`).
- **Aspect Ratio & Slot Orientation Matching:**
  - Matches portrait photos to vertical slots with `"top"` crop focus.
  - Matches landscape photos to horizontal slots with `"center"` crop focus.
  - Places top-ranked photos into slot 1 (primary focus slot).

### 2. Auto-Flow Dialog UI (`AutoFlowModal.jsx`)
- Interactive configuration modal accessible directly via **"⚡ Auto-Flow"** on the Album Workspace.
- Photo source mode selection with live counts.
- Strategy selection with visual descriptions.
- Max photos per spread selector (1 to 6).
- Live layout estimation summary box.
- Actions:
  - **"⚡ Replace Album Spreads"**: Atomically replaces the current album spreads.
  - **"+ Append Spreads"**: Appends the newly generated auto-flow spreads after existing sheets.

### 3. Atomic Album Mutation (`SET_SHEETS`)
- Added `SET_SHEETS` intent to `AlbumSheetSchema.js` to replace all sheets in a single atomic validated transaction with full Undo/Redo history support.

---

## Verification & Test Results
- **ALB-082 Test Suite (`tests/alb082-auto-flow-engine.test.js`)**: 47 assertions PASS.
- **ALB-081 Manual Designer Workflow**: 48 assertions PASS.
- **ALB-080 Album Domain & Schema**: 17 assertions PASS.
- **ALB-072 Photo Culling & Comparison**: 42 assertions PASS.
- **ALB-071 Burst & Quality Signals**: 55 assertions PASS.
- **ALB-050 Architecture Policy**: 231 assertions PASS (111 active reachable files).
- **ALB-051 Regression Coverage**: 890 assertions PASS (111/111 files reached).
- **ALB-052 Product Hardening**: 89 assertions PASS.
- **Full Repository Test Suite (`npm test`)**: 28 test suites PASS (100%).
- **Production Webpack Bundle**: Clean build (620 KiB within 630 KiB budget).
