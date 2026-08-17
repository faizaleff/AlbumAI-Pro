/**
 * Photo Culling Service for AlbumAI Pro
 * Provides Keep/Reject/Unrated lifecycle, Burst Auto-Pick, and Culling Summaries.
 */

export const CullingStatus = Object.freeze({
    KEEP: "KEEP",
    REJECT: "REJECT",
    UNRATED: "UNRATED"
});

export const CullingFilterMode = Object.freeze({
    ALL: "ALL",
    KEPT: "KEPT",
    REJECTED: "REJECTED",
    UNRATED: "UNRATED"
});

const VALID_STATUSES = new Set(Object.values(CullingStatus));

export function normalizeCullingStatus(value) {
    if (typeof value === "string") {
        const upper = value.toUpperCase().trim();
        if (VALID_STATUSES.has(upper)) {
            return upper;
        }
    }
    return CullingStatus.UNRATED;
}

/**
 * Automatically picks the best photo in each burst sequence.
 * Sets the highest quality photo to KEEP and lower quality burst peers to REJECT.
 */
export function autoPickBurstBest(photos = [], bursts = [], currentDecisions = { items: [] }, updateDecisionFn) {
    if (!Array.isArray(bursts) || bursts.length === 0 || typeof updateDecisionFn !== "function") {
        return currentDecisions;
    }

    const photoMap = new Map((Array.isArray(photos) ? photos : []).map(p => [p.id, p]));
    let updated = currentDecisions;

    for (const burst of bursts) {
        if (!burst || !Array.isArray(burst.photoIds) || burst.photoIds.length <= 1) {
            continue;
        }

        const bestId = burst.bestPhotoId;
        for (const photoId of burst.photoIds) {
            const photo = photoMap.get(photoId);
            if (!photo) continue;

            const isBest = photoId === bestId;
            const newCulling = isBest ? CullingStatus.KEEP : CullingStatus.REJECT;

            updated = updateDecisionFn(updated, photo, {
                culling: newCulling
            });
        }
    }

    return updated;
}

/**
 * Filter an array of photos by their current culling status.
 */
export function filterPhotosByCulling(photos = [], filterMode = CullingFilterMode.ALL, getDecisionFn) {
    if (!Array.isArray(photos)) return Object.freeze([]);
    if (filterMode === CullingFilterMode.ALL || !getDecisionFn) {
        return Object.freeze(photos);
    }

    const targetStatus = filterMode === CullingFilterMode.KEPT
        ? CullingStatus.KEEP
        : filterMode === CullingFilterMode.REJECTED
            ? CullingStatus.REJECT
            : CullingStatus.UNRATED;

    const filtered = photos.filter(photo => {
        const decision = getDecisionFn(photo);
        const status = normalizeCullingStatus(decision?.culling);
        return status === targetStatus;
    });

    return Object.freeze(filtered);
}

/**
 * Generates culling metrics and statistics for the current workspace.
 */
export function summarizeCulling(photos = [], getDecisionFn, bursts = []) {
    const list = Array.isArray(photos) ? photos : [];
    let kept = 0;
    let rejected = 0;
    let unrated = 0;

    for (const photo of list) {
        const decision = typeof getDecisionFn === "function" ? getDecisionFn(photo) : null;
        const status = normalizeCullingStatus(decision?.culling);
        if (status === CullingStatus.KEEP) kept++;
        else if (status === CullingStatus.REJECT) rejected++;
        else unrated++;
    }

    const burstCount = Array.isArray(bursts) ? bursts.length : 0;
    let burstBestCount = 0;
    if (Array.isArray(bursts)) {
        for (const burst of bursts) {
            if (burst?.bestPhotoId) burstBestCount++;
        }
    }

    return Object.freeze({
        total: list.length,
        kept,
        rejected,
        unrated,
        burstCount,
        burstBestCount
    });
}
