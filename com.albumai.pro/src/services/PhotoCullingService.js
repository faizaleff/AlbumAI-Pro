/**
 * Photo Culling Service for AlbumAI Pro
 * Provides included-by-default review, Reject/Unreject, Burst Review, and summaries.
 * Legacy KEEP values remain readable for backward compatibility only.
 */

export const CullingStatus = Object.freeze({
    KEEP: "KEEP",
    REJECT: "REJECT",
    UNRATED: "UNRATED"
});

export const CullingFilterMode = Object.freeze({
    ALL: "ALL",
    INCLUDED: "INCLUDED",
    KEPT: "KEPT",
    REJECTED: "REJECTED",
    UNRATED: "UNRATED"
});

export const PHOTO_BURST_REVIEWS_SCHEMA = 1;
const MAX_BURST_REVIEWS = 5000;

function burstPhotoKey(photo) {
    const source = photo?.file?.nativePath || photo?.id || photo?.name;
    if (typeof source !== "string" || !source) return null;
    let left = 0x811c9dc5;
    let right = 0x9e3779b9;
    const normalized = source.normalize ? source.normalize("NFC") : source;
    for (let index = 0; index < normalized.length; index += 1) {
        const code = normalized.charCodeAt(index);
        left = Math.imul((left ^ code) >>> 0, 0x01000193);
        right = Math.imul((right ^ code) >>> 0, 0x01000193);
    }
    return `p1-${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizePhotoBurstReviews(value = {}, photos = [], bursts = []) {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const photoById = new Map((Array.isArray(photos) ? photos : [])
        .map(photo => [photo?.id, photo]));
    const availableKeys = new Set([...photoById.values()].map(burstPhotoKey).filter(Boolean));
    const availableGroups = new Map((Array.isArray(bursts) ? bursts : [])
        .map(group => [group?.groupId, group]));
    const items = [];
    const seen = new Set();
    for (const candidate of Array.isArray(source.items)
        ? source.items.slice(0, MAX_BURST_REVIEWS)
        : []) {
        const groupId = typeof candidate?.groupId === "string"
            ? candidate.groupId.trim().slice(0, 120)
            : "";
        if (!groupId || seen.has(groupId)) continue;
        const group = availableGroups.get(groupId);
        if (!group && availableGroups.size) continue;
        const groupKeys = group
            ? new Set(group.photoIds.map(id => burstPhotoKey(photoById.get(id))).filter(Boolean))
            : availableKeys;
        const selectedPhotoKeys = [...new Set(
            (Array.isArray(candidate.selectedPhotoKeys)
                ? candidate.selectedPhotoKeys
                : [])
                .filter(key => /^p1-[0-9a-f]{16}$/.test(key || "") && groupKeys.has(key))
        )];
        const aiBestPhotoKey = /^p1-[0-9a-f]{16}$/.test(candidate.aiBestPhotoKey || "") &&
            groupKeys.has(candidate.aiBestPhotoKey)
            ? candidate.aiBestPhotoKey
            : group
                ? burstPhotoKey(photoById.get(group.bestPhotoId))
                : null;
        if (!selectedPhotoKeys.length && aiBestPhotoKey) selectedPhotoKeys.push(aiBestPhotoKey);
        if (!selectedPhotoKeys.length) continue;
        seen.add(groupId);
        items.push(Object.freeze({
            groupId,
            aiBestPhotoKey,
            selectedPhotoKeys: Object.freeze(selectedPhotoKeys),
            reviewed: candidate.reviewed === true,
            appliedAt: typeof candidate.appliedAt === "string"
                ? candidate.appliedAt.slice(0, 40)
                : null
        }));
    }
    return Object.freeze({
        schemaVersion: PHOTO_BURST_REVIEWS_SCHEMA,
        items: Object.freeze(items)
    });
}

export function applyBurstReview({
    value = {},
    photos = [],
    bursts = [],
    groupId,
    selectedPhotos = [],
    decisions = { items: [] },
    updateDecisionFn,
    appliedAt = new Date().toISOString()
} = {}) {
    const group = bursts.find(item => item?.groupId === groupId);
    if (!group || typeof updateDecisionFn !== "function") {
        return Object.freeze({
            reviews: normalizePhotoBurstReviews(value, photos, bursts),
            decisions
        });
    }
    const photoById = new Map(photos.map(photo => [photo?.id, photo]));
    const groupPhotos = group.photoIds.map(id => photoById.get(id)).filter(Boolean);
    const selectedKeys = new Set(selectedPhotos.map(burstPhotoKey).filter(Boolean));
    const aiBest = photoById.get(group.bestPhotoId);
    if (!selectedKeys.size && aiBest) selectedKeys.add(burstPhotoKey(aiBest));
    let nextDecisions = decisions;
    for (const photo of groupPhotos) {
        nextDecisions = updateDecisionFn(nextDecisions, photo, {
            culling: selectedKeys.has(burstPhotoKey(photo))
                ? CullingStatus.UNRATED
                : CullingStatus.REJECT
        });
    }
    const current = normalizePhotoBurstReviews(value, photos, bursts);
    const items = current.items.filter(item => item.groupId !== groupId);
    items.push({
        groupId,
        aiBestPhotoKey: burstPhotoKey(aiBest),
        selectedPhotoKeys: [...selectedKeys],
        reviewed: true,
        appliedAt
    });
    return Object.freeze({
        reviews: normalizePhotoBurstReviews({ items }, photos, bursts),
        decisions: nextDecisions
    });
}

export function isPhotoRejected(decision) {
    return normalizeCullingStatus(decision?.culling) === CullingStatus.REJECT;
}

export function photoReviewState(decision) {
    return isPhotoRejected(decision) ? "REJECTED" : "INCLUDED";
}

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
 * Legacy automatic burst helper retained for compatible project/test reads.
 * New Library workflows use applyBurstReview and treat every non-rejected frame
 * as included, without exposing KEEP as an active decision.
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

    if (filterMode === CullingFilterMode.INCLUDED) {
        return Object.freeze(photos.filter(photo =>
            !isPhotoRejected(getDecisionFn(photo))
        ));
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
        included: list.length - rejected,
        kept,
        rejected,
        unrated,
        burstCount,
        burstBestCount
    });
}
