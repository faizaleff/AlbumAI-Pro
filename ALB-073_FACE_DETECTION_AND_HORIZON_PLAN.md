# ALB-073: Fast Face Detection & Facial Horizon Centering

## Executive Summary
ALB-073 implements a deterministic local face detection and facial horizon centering engine (`PhotoFaceDetectionEngine.js`). It extracts face bounding boxes using $YC_bC_r$ skin chrominance segmentation and connected cluster analysis, calculates weighted facial centroids, and computes optimal crop focus anchors (`top`, `center`, `bottom`, `left`, `right`) and focal coordinates so people's faces remain intact and well-framed during Auto-Flow and manual layout composition.

---

## Key Features & Capabilities

### 1. Fast Face Detection Engine (`PhotoFaceDetectionEngine.js`)
- **$YC_bC_r$ Skin Chrominance Segmentation:**
  - Fast thresholding checking $Y \ge 30, 80 \le C_b \le 138, 130 \le C_r \le 180$.
- **Block-Based Facial Cluster Analysis:**
  - Divides image into adaptive grid blocks and groups high-density skin blocks into candidate face bounding boxes.
  - Normalizes coordinates $[0.0, 1.0]$ with center coordinates and confidence scores.
- **Optimal Crop Focus & Facial Horizon Centering:**
  - `computeOptimalCropFocus(faces, photoWidth, photoHeight)`:
    - Calculates weighted centroid of detected faces.
    - High facial horizon ($y < 0.38$) -> sets `cropFocus: "top"`.
    - Low facial horizon ($y > 0.65$) -> sets `cropFocus: "bottom"`.
    - Left-oriented subjects ($x < 0.38$) -> sets `cropFocus: "left"`.
    - Right-oriented subjects ($x > 0.62$) -> sets `cropFocus: "right"`.
    - Centered subjects -> sets `cropFocus: "center"`.

### 2. Auto-Flow & Canvas UI Integration
- **`PhotoAutoFlowEngine.js`:**
  - Automatically invokes `computeOptimalCropFocus` during template slot assignment, assigning face-centered crop anchors without manual user intervention.
- **`SpreadCanvas.jsx`:**
  - Slot header displays subtle face count badge indicators (`👤 2`) when photos have detected faces.
- **`styles.css`:**
  - Added dark-theme styling for `.spread-slot-title-group` and `.spread-slot-face-badge`.

---

## Verification & Test Results
- **ALB-073 Test Suite (`tests/alb073-face-detection-engine.test.js`)**: 32 assertions PASS.
- **ALB-090 Print Export & Proofing Engine**: 39 assertions PASS.
- **ALB-082 Smart Auto-Flow Engine**: 47 assertions PASS.
- **ALB-081 Manual Designer Workflow**: 48 assertions PASS.
- **ALB-080 Album Domain & Schema**: 17 assertions PASS.
- **ALB-072 Photo Culling & Comparison**: 42 assertions PASS.
- **ALB-071 Burst & Quality Signals**: 55 assertions PASS.
- **ALB-050 Architecture Policy**: 234 assertions PASS (114 active reachable files).
- **ALB-051 Regression Coverage**: 909 assertions PASS (114/114 files reached).
- **ALB-052 Product Hardening**: 89 assertions PASS.
- **Full Repository Test Suite (`npm test`)**: 30 test suites PASS (100%).
- **Production Webpack Bundle**: Clean build (639 KiB within 650 KiB budget).
