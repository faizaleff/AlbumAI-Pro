# ALB-071 — Photo Quality Signals and Grouping Architecture

Status: **IMPLEMENTED & VERIFIED**

Baseline: **`origin/main` at `fa08e5d`**

## Goal

Establish deterministic, on-device heuristics and analysis pipelines for photo quality scoring (sharpness, exposure, contrast, composite ranking) and photo grouping (burst sequence detection, event temporal clustering) while strictly upholding AlbumAI Pro's local-only privacy boundary.

## Implemented Modules

### 1. Photo Quality Signal Engine (`src/services/PhotoQualitySignalEngine.js`)

- **Sharpness / Focus Signal (`sharpness_v1`)**:
  - Extracts luminance buffer from RGBA pixels: $Y = (77R + 150G + 29B) \gg 8$.
  - Discrete Laplacian operator: $\begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}$.
  - Computes non-negative variance of the Laplacian response.
  - Normalizes to $[0.0, 1.0]$ using bounded sigmoid scaling ($K = 400$).
- **Exposure / Dynamic Range Signal (`exposure_v1`)**:
  - 256-bin luminance histogram.
  - Penalizes extreme dark clipping ($< 10$) and bright clipping ($> 245$).
  - Evaluates midtone balance centered around target luminance $\mu \approx 128$.
- **Contrast Signal (`contrast_v1`)**:
  - Computes standard deviation of luminance across the image.
  - Scaled relative to standard reference dynamic range.
- **Composite Rank Score (`rankScore`)**:
  - Weighted combination: $0.50 \times \text{sharpness} + 0.35 \times \text{exposure} + 0.15 \times \text{contrast}$.
- **PhotoAiPolicy Integration**:
  - Generates immutable, schema-versioned analysis records conforming to `PhotoAiPolicy.js`.
  - Fails closed for malformed or unreadable pixel buffers.

### 2. Photo Grouping Engine (`src/services/PhotoGroupingEngine.js`)

- **Burst Grouping (`groupPhotosByBurst`)**:
  - Clusters consecutive captures taken within $\le 3000\text{ ms}$ ($\Delta t \le 3\text{s}$).
  - Automatically identifies the `bestPhotoId` in the cluster based on quality rank score and user rating.
- **Event Grouping (`groupPhotosByEvent`)**:
  - Clusters photos into distinct events when the temporal gap between consecutive shots exceeds $\ge 30\text{ minutes}$.
  - Generates human-readable labels with localized date and time summaries.
- **Photo Group Index (`buildPhotoGroupIndex`)**:
  - Fast $O(N)$ lookup map indexing photos by `burstGroupId`, `isBurstBest`, and `eventId`.

### 3. Photo Workspace & Browser Integration

- `PhotoWorkspaceService`:
  - Added `setPhotoAiConsent`, `getPhotoAiPolicyState`, `getPhotoBursts`, `getPhotoEvents`, and `getPhotoGroupIndex`.
- `PhotoBrowserModel`:
  - Added `"quality"` to `SORT_FIELDS` and `sortValue` comparator.
- `PhotoBrowserSection`:
  - Added `"Quality (AI)"` option to photo sorting dropdown.

## Verification

- `node tests/run-alb071-tests.js`: PASS (55 assertions).
- `npm test`: PASS across all 24 test suites.
- `npm run architecture:verify`: PASS (219 assertions, 105 reachable files).
- `npm run regression:verify`: PASS (833 assertions, 105/105 files reached).
- `npm run hardening:verify`: PASS (89 assertions).
- `npm run build:prod`: PASS (Webpack 5 production build succeeded).
