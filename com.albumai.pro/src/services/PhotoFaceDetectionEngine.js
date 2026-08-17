/**
 * Fast Local Face Detection & Facial Horizon Centering Engine for AlbumAI Pro
 * Provides deterministic skin chrominance segmentation, facial cluster detection,
 * and optimal face-aware crop focus anchoring.
 */

/**
 * Checks if an RGB pixel falls within standard human skin chrominance boundaries.
 */
export function isSkinColor(r, g, b) {
    if (r <= 35 || g <= 20 || b <= 15) return false;
    if (r <= g || r <= b) return false;
    if (Math.abs(r - g) < 8) return false;

    // Convert to YCbCr
    const y = (0.299 * r) + (0.587 * g) + (0.114 * b);
    const cb = 128 - (0.168736 * r) - (0.331264 * g) + (0.5 * b);
    const cr = 128 + (0.5 * r) - (0.418688 * g) - (0.081312 * b);

    return y >= 30 && cb >= 80 && cb <= 138 && cr >= 130 && cr <= 180;
}

/**
 * Detects face candidates in raw RGBA pixels using skin cluster segmentation.
 * Returns normalized bounding boxes in [0.0, 1.0] coordinates.
 */
export function detectFaces(rgbaPixels, width, height) {
    if (!rgbaPixels || width < 16 || height < 16) {
        return Object.freeze({ faces: Object.freeze([]), faceCount: 0, primaryFace: null });
    }

    const blockSize = Math.max(8, Math.min(32, Math.floor(Math.min(width, height) / 16)));
    const gridCols = Math.floor(width / blockSize);
    const gridRows = Math.floor(height / blockSize);
    const grid = new Float32Array(gridCols * gridRows);

    // Step 1: Compute skin density per grid block
    for (let gy = 0; gy < gridRows; gy++) {
        for (let gx = 0; gx < gridCols; gx++) {
            let skinPixels = 0;
            const totalPixelsInBlock = blockSize * blockSize;
            const startY = gy * blockSize;
            const startX = gx * blockSize;

            for (let py = 0; py < blockSize; py++) {
                const rowOffset = ((startY + py) * width + startX) * 4;
                for (let px = 0; px < blockSize; px++) {
                    const idx = rowOffset + (px * 4);
                    const r = rgbaPixels[idx];
                    const g = rgbaPixels[idx + 1];
                    const b = rgbaPixels[idx + 2];
                    if (isSkinColor(r, g, b)) {
                        skinPixels++;
                    }
                }
            }

            grid[gy * gridCols + gx] = skinPixels / totalPixelsInBlock;
        }
    }

    // Step 2: Find connected skin clusters with high density (>= 0.35)
    const visited = new Uint8Array(gridCols * gridRows);
    const rawClusters = [];

    for (let gy = 0; gy < gridRows; gy++) {
        for (let gx = 0; gx < gridCols; gx++) {
            const idx = gy * gridCols + gx;
            if (visited[idx] || grid[idx] < 0.35) continue;

            // Breadth-first search for connected cluster
            let minGx = gx;
            let maxGx = gx;
            let minGy = gy;
            let maxGy = gy;
            let clusterDensitySum = 0;
            let clusterBlockCount = 0;

            const queue = [[gx, gy]];
            visited[idx] = 1;

            while (queue.length > 0) {
                const [cx, cy] = queue.shift();
                const cidx = cy * gridCols + cx;
                clusterDensitySum += grid[cidx];
                clusterBlockCount++;

                minGx = Math.min(minGx, cx);
                maxGx = Math.max(maxGx, cx);
                minGy = Math.min(minGy, cy);
                maxGy = Math.max(maxGy, cy);

                // Check 4-connected neighbors
                const neighbors = [
                    [cx + 1, cy],
                    [cx - 1, cy],
                    [cx, cy + 1],
                    [cx, cy - 1]
                ];

                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < gridCols && ny >= 0 && ny < gridRows) {
                        const nidx = ny * gridCols + nx;
                        if (!visited[nidx] && grid[nidx] >= 0.35) {
                            visited[nidx] = 1;
                            queue.push([nx, ny]);
                        }
                    }
                }
            }

            // Cluster filter: must be at least 2 blocks and reasonable aspect ratio
            if (clusterBlockCount >= 2) {
                const clusterWidthPx = (maxGx - minGx + 1) * blockSize;
                const clusterHeightPx = (maxGy - minGy + 1) * blockSize;
                const aspect = clusterWidthPx / clusterHeightPx;

                if (aspect >= 0.5 && aspect <= 1.8) {
                    const normX = (minGx * blockSize) / width;
                    const normY = (minGy * blockSize) / height;
                    const normW = Math.min(1.0 - normX, clusterWidthPx / width);
                    const normH = Math.min(1.0 - normY, clusterHeightPx / height);
                    const avgDensity = clusterDensitySum / clusterBlockCount;

                    rawClusters.push({
                        x: Number(normX.toFixed(4)),
                        y: Number(normY.toFixed(4)),
                        width: Number(normW.toFixed(4)),
                        height: Number(normH.toFixed(4)),
                        centerX: Number((normX + normW / 2).toFixed(4)),
                        centerY: Number((normY + normH / 2).toFixed(4)),
                        confidence: Number(Math.min(0.99, avgDensity * 1.2).toFixed(3))
                    });
                }
            }
        }
    }

    // Sort by area / confidence descending
    rawClusters.sort((a, b) => (b.width * b.height * b.confidence) - (a.width * a.height * a.confidence));

    const frozenFaces = Object.freeze(rawClusters.map(f => Object.freeze(f)));

    return Object.freeze({
        faces: frozenFaces,
        faceCount: frozenFaces.length,
        primaryFace: frozenFaces[0] || null
    });
}

/**
 * Computes optimal crop focus anchor and focal point based on detected faces.
 */
export function computeOptimalCropFocus(faces = [], photoWidth = 1, photoHeight = 1) {
    const faceList = Array.isArray(faces) ? faces : (faces?.faces || []);

    if (faceList.length === 0) {
        const photoAspect = photoWidth / Math.max(1, photoHeight);
        // Tall portrait photos default to top focus
        if (photoAspect < 0.85) {
            return Object.freeze({
                cropFocus: "top",
                focalX: 0.5,
                focalY: 0.25,
                hasFaces: false
            });
        }
        return Object.freeze({
            cropFocus: "center",
            focalX: 0.5,
            focalY: 0.5,
            hasFaces: false
        });
    }

    // Compute weighted centroid of faces (giving more weight to larger faces)
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const face of faceList) {
        const area = (face.width || 0.1) * (face.height || 0.1);
        const weight = area * (face.confidence || 0.5);
        totalWeight += weight;
        weightedX += (face.centerX ?? (face.x + (face.width / 2))) * weight;
        weightedY += (face.centerY ?? (face.y + (face.height / 2))) * weight;
    }

    const focalX = totalWeight > 0 ? Number((weightedX / totalWeight).toFixed(3)) : 0.5;
    const focalY = totalWeight > 0 ? Number((weightedY / totalWeight).toFixed(3)) : 0.35;

    let cropFocus = "center";

    if (focalY < 0.38) {
        cropFocus = "top";
    } else if (focalY > 0.65) {
        cropFocus = "bottom";
    } else if (focalX < 0.38) {
        cropFocus = "left";
    } else if (focalX > 0.62) {
        cropFocus = "right";
    } else {
        cropFocus = "center";
    }

    return Object.freeze({
        cropFocus,
        focalX,
        focalY,
        hasFaces: true,
        faceCount: faceList.length
    });
}
