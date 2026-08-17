/**
 * Photo Grouping Engine for AlbumAI Pro
 * Groups photos into Bursts (rapid succession shots) and Events (temporal sessions).
 */

export const DEFAULT_BURST_THRESHOLD_MS = 3000; // 3 seconds
export const DEFAULT_EVENT_GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

function getPhotoTimestamp(photo) {
    if (!photo) return 0;
    const candidates = [
        photo.metadata?.dateTaken,
        photo.metadata?.dateTimeOriginal,
        photo.dateTaken,
        photo.dateModified,
        photo.modified,
        photo.created,
        photo.lastModified
    ];
    for (const val of candidates) {
        if (typeof val === "number" && Number.isFinite(val) && val > 0) {
            return val;
        }
        if (typeof val === "string" && val.trim().length > 0) {
            const parsed = new Date(val).getTime();
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }
    }
    return 0;
}

function getPhotoQualityScore(photo) {
    if (!photo) return 0;
    return photo.aiAnalysis?.aggregate?.rankScore || photo.rating || 0;
}

/**
 * Group photos by burst (rapid consecutive captures).
 */
export function groupPhotosByBurst(photos = [], burstThresholdMs = DEFAULT_BURST_THRESHOLD_MS) {
    if (!Array.isArray(photos) || photos.length === 0) {
        return Object.freeze([]);
    }

    // Sort with timestamp, keeping stable original order for identical timestamps
    const indexed = photos.map((photo, idx) => ({
        photo,
        id: photo.id || `photo-${idx}`,
        timestamp: getPhotoTimestamp(photo),
        qualityScore: getPhotoQualityScore(photo),
        originalIndex: idx
    }));

    // Filter photos with valid timestamps for chronological grouping
    const withTime = indexed.filter(p => p.timestamp > 0);
    withTime.sort((a, b) => a.timestamp - b.timestamp || a.originalIndex - b.originalIndex);

    const burstGroups = [];
    let currentCluster = [];

    for (let i = 0; i < withTime.length; i++) {
        const item = withTime[i];
        if (currentCluster.length === 0) {
            currentCluster.push(item);
        } else {
            const prev = currentCluster[currentCluster.length - 1];
            const diff = item.timestamp - prev.timestamp;
            if (diff >= 0 && diff <= burstThresholdMs) {
                currentCluster.push(item);
            } else {
                if (currentCluster.length > 1) {
                    burstGroups.push(finalizeBurstGroup(burstGroups.length + 1, currentCluster));
                }
                currentCluster = [item];
            }
        }
    }

    if (currentCluster.length > 1) {
        burstGroups.push(finalizeBurstGroup(burstGroups.length + 1, currentCluster));
    }

    return Object.freeze(burstGroups);
}

function finalizeBurstGroup(index, cluster) {
    const photoIds = cluster.map(item => item.id);
    let best = cluster[0];
    for (let i = 1; i < cluster.length; i++) {
        if (cluster[i].qualityScore > best.qualityScore) {
            best = cluster[i];
        }
    }
    return Object.freeze({
        groupId: `burst-group-${index}`,
        photoIds: Object.freeze(photoIds),
        bestPhotoId: best.id,
        count: photoIds.length,
        startTime: cluster[0].timestamp,
        endTime: cluster[cluster.length - 1].timestamp
    });
}

/**
 * Group photos by Event / Scene based on capture time gaps.
 */
export function groupPhotosByEvent(photos = [], eventGapThresholdMs = DEFAULT_EVENT_GAP_THRESHOLD_MS) {
    if (!Array.isArray(photos) || photos.length === 0) {
        return Object.freeze([]);
    }

    const indexed = photos.map((photo, idx) => ({
        photo,
        id: photo.id || `photo-${idx}`,
        timestamp: getPhotoTimestamp(photo),
        originalIndex: idx
    }));

    const withTime = indexed.filter(p => p.timestamp > 0);
    withTime.sort((a, b) => a.timestamp - b.timestamp || a.originalIndex - b.originalIndex);

    if (withTime.length === 0) {
        return Object.freeze([]);
    }

    const events = [];
    let currentEvent = [withTime[0]];

    for (let i = 1; i < withTime.length; i++) {
        const item = withTime[i];
        const prev = currentEvent[currentEvent.length - 1];
        const diff = item.timestamp - prev.timestamp;

        if (diff > eventGapThresholdMs) {
            events.push(finalizeEventGroup(events.length + 1, currentEvent));
            currentEvent = [item];
        } else {
            currentEvent.push(item);
        }
    }

    if (currentEvent.length > 0) {
        events.push(finalizeEventGroup(events.length + 1, currentEvent));
    }

    return Object.freeze(events);
}

function finalizeEventGroup(index, cluster) {
    const photoIds = cluster.map(item => item.id);
    const startDate = new Date(cluster[0].timestamp);
    const dateLabel = startDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    const timeLabel = startDate.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    });

    return Object.freeze({
        eventId: `event-group-${index}`,
        label: `Event ${index} (${dateLabel} ${timeLabel})`,
        photoIds: Object.freeze(photoIds),
        count: photoIds.length,
        startTime: cluster[0].timestamp,
        endTime: cluster[cluster.length - 1].timestamp
    });
}

/**
 * Creates mapping from photoId -> { burstGroupId, eventGroupId, isBurstBest }
 */
export function buildPhotoGroupIndex(photos = [], {
    burstThresholdMs = DEFAULT_BURST_THRESHOLD_MS,
    eventGapThresholdMs = DEFAULT_EVENT_GAP_THRESHOLD_MS
} = {}) {
    const bursts = groupPhotosByBurst(photos, burstThresholdMs);
    const events = groupPhotosByEvent(photos, eventGapThresholdMs);

    const index = new Map();

    for (const burst of bursts) {
        for (const photoId of burst.photoIds) {
            const entry = index.get(photoId) || {};
            entry.burstGroupId = burst.groupId;
            entry.isBurstBest = photoId === burst.bestPhotoId;
            entry.burstCount = burst.count;
            index.set(photoId, entry);
        }
    }

    for (const event of events) {
        for (const photoId of event.photoIds) {
            const entry = index.get(photoId) || {};
            entry.eventId = event.eventId;
            entry.eventLabel = event.label;
            index.set(photoId, entry);
        }
    }

    return index;
}
