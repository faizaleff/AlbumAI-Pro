import {
    groupPhotosByBurst,
    groupPhotosByEvent
} from "./PhotoGroupingEngine";
import { computeOptimalCropFocus } from "./PhotoFaceDetectionEngine";
import { CullingStatus, normalizeCullingStatus } from "./PhotoCullingService";

export const AutoFlowStrategy = Object.freeze({
    CHRONOLOGICAL_BURST: "CHRONOLOGICAL_BURST",
    HERO_DYNAMIC: "HERO_DYNAMIC",
    BALANCED: "BALANCED"
});

export const PhotoSourceMode = Object.freeze({
    KEPT_ONLY: "KEPT_ONLY",
    SELECTED_ONLY: "SELECTED_ONLY",
    ALL_PHOTOS: "ALL_PHOTOS"
});

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
    return photo.aiAnalysis?.aggregate?.rankScore || photo.quality?.rankScore || photo.rating || 0;
}

function isPortraitPhoto(photo) {
    const width = photo.metadata?.width || photo.width;
    const height = photo.metadata?.height || photo.height;
    if (width && height) {
        return height > width;
    }
    return false;
}

function photoCullingStatus(photo, getDecisionFn) {
    return normalizeCullingStatus(typeof getDecisionFn === "function"
        ? getDecisionFn(photo)?.culling
        : photo?.culling?.status);
}

/**
 * Filter photos according to source mode
 */
export function filterPhotosForAutoFlow(photos = [], mode = PhotoSourceMode.KEPT_ONLY, selectedPhotoIds = new Set(), getDecisionFn) {
    if (!Array.isArray(photos) || photos.length === 0) return [];

    switch (mode) {
        case PhotoSourceMode.SELECTED_ONLY: {
            const idSet = selectedPhotoIds instanceof Set ? selectedPhotoIds : new Set(selectedPhotoIds);
            return photos.filter(p => idSet.has(p.id));
        }

        case PhotoSourceMode.KEPT_ONLY: {
            return photos.filter(photo => photoCullingStatus(photo, getDecisionFn) === CullingStatus.KEEP);
        }

        case PhotoSourceMode.ALL_PHOTOS:
        default:
            return photos.filter(photo => photoCullingStatus(photo, getDecisionFn) !== CullingStatus.REJECT);
    }
}

/**
 * Compute the actual usable smart object slot capacity for a template
 */
export function getTemplateSlotCapacity(template) {
    if (!template) return 0;
    if (Array.isArray(template.smartObjects) && template.smartObjects.length > 0) {
        return template.smartObjects.filter(slot => slot && (slot.layerId != null || slot.id != null)).length;
    }
    if (Number.isInteger(template.slotCount) && template.slotCount > 0) {
        return template.slotCount;
    }
    return 0;
}

/**
 * Select best available template matching target slot count with visual diversity
 */
export function selectBestTemplate(templates = [], targetSlotCount = 2, previousTemplateId = null) {
    if (!Array.isArray(templates) || templates.length === 0) return null;

    // Filter templates with valid IDs
    const valid = templates.filter(t => t && t.id);
    if (valid.length === 0) return null;

    // Exact matches
    const exactMatches = valid.filter(t => getTemplateSlotCapacity(t) === targetSlotCount);
    if (exactMatches.length > 0) {
        if (exactMatches.length === 1 || !previousTemplateId) {
            return exactMatches[0];
        }
        // Pick one different from previous for visual variety
        const different = exactMatches.find(t => t.id !== previousTemplateId);
        return different || exactMatches[0];
    }

    // Closest match
    let closest = valid[0];
    let minDiff = Math.abs(getTemplateSlotCapacity(closest) - targetSlotCount);

    for (let i = 1; i < valid.length; i++) {
        const diff = Math.abs(getTemplateSlotCapacity(valid[i]) - targetSlotCount);
        if (diff < minDiff) {
            minDiff = diff;
            closest = valid[i];
        }
    }

    return closest;
}

/**
 * Assign a chunk of photos to template slots
 */
export function assignPhotosToTemplateSlots(photos = [], template = null) {
    if (!template || !Array.isArray(photos) || photos.length === 0) {
        return [];
    }

    const smartObjects = Array.isArray(template.smartObjects) && template.smartObjects.length > 0
        ? template.smartObjects.filter(slot => slot && (slot.layerId != null || slot.id != null))
        : [];

    if (smartObjects.length === 0) {
        return [];
    }

    // Sort photos: prioritize highest quality photo for the first/hero slot
    const sortedPhotos = [...photos].sort((a, b) => getPhotoQualityScore(b) - getPhotoQualityScore(a));

    const assignments = [];
    const count = Math.min(sortedPhotos.length, smartObjects.length);

    for (let i = 0; i < count; i++) {
        const photo = sortedPhotos[i];
        const slot = smartObjects[i];
        const slotId = slot.layerId ?? slot.id ?? (i + 1);
        const isPortrait = isPortraitPhoto(photo);
        const photoWidth = photo.metadata?.width || photo.width || (isPortrait ? 3000 : 4000);
        const photoHeight = photo.metadata?.height || photo.height || (isPortrait ? 4000 : 3000);
        const faceFocus = computeOptimalCropFocus(
            photo.faces || photo.aiAnalysis?.faces || [],
            photoWidth,
            photoHeight
        );
        const cropFocus = faceFocus.cropFocus || (isPortrait ? "top" : "center");

        assignments.push(Object.freeze({
            slotId,
            photoId: photo.id,
            cropFocus
        }));
    }

    return Object.freeze(assignments);
}

/**
 * Core Smart Auto-Flow Engine
 */
export function generateAutoFlowSpreads({
    photos = [],
    templates = [],
    options = {}
}) {
    const {
        strategy = AutoFlowStrategy.CHRONOLOGICAL_BURST,
        maxPhotosPerSpread = 3,
        minPhotosPerSpread = 1,
        sheetPrefix = "Spread",
        startIndex = 1,
        eventGapMinutes = 30
    } = options;

    if (!Array.isArray(photos) || photos.length === 0) {
        return Object.freeze({
            success: false,
            reason: "NO_PHOTOS",
            sheets: Object.freeze([]),
            summary: Object.freeze({ totalSheets: 0, totalPhotosPlaced: 0, eventCount: 0 })
        });
    }

    if (!Array.isArray(templates) || templates.length === 0) {
        return Object.freeze({
            success: false,
            reason: "NO_TEMPLATES",
            sheets: Object.freeze([]),
            summary: Object.freeze({ totalSheets: 0, totalPhotosPlaced: 0, eventCount: 0 })
        });
    }

    const maxTemplateCapacity = Math.max(...templates.map(getTemplateSlotCapacity), 0);
    const effectiveMaxPhotos = maxTemplateCapacity > 0
        ? Math.max(1, Math.min(maxPhotosPerSpread, maxTemplateCapacity))
        : Math.max(1, maxPhotosPerSpread);

    // Sort photos chronologically
    const chronologicalPhotos = [...photos].sort((a, b) => {
        const tA = getPhotoTimestamp(a);
        const tB = getPhotoTimestamp(b);
        if (tA > 0 && tB > 0) return tA - tB;
        return 0;
    });

    // BALANCED DENSITY: Global balanced packing across available template capacity
    // Packs all source photos continuously into chunks of effectiveMaxPhotos without event boundary fragmentation
    if (strategy === AutoFlowStrategy.BALANCED) {
        const generatedSheets = [];
        let sheetNumber = startIndex;
        let previousTemplateId = null;
        let totalPhotosPlaced = 0;

        for (let i = 0; i < chronologicalPhotos.length; i += effectiveMaxPhotos) {
            const chunk = chronologicalPhotos.slice(i, i + effectiveMaxPhotos);
            if (chunk.length === 0) continue;

            const template = selectBestTemplate(templates, chunk.length, previousTemplateId);
            if (!template) continue;

            previousTemplateId = template.id;
            const slots = assignPhotosToTemplateSlots(chunk, template);
            totalPhotosPlaced += slots.length;

            const sheetId = `${sheetPrefix}_${sheetNumber}`.replace(/[^A-Za-z0-9_-]/g, "_");

            generatedSheets.push(Object.freeze({
                id: sheetId,
                templateId: template.id,
                label: `Spread ${sheetNumber}`,
                slots
            }));

            sheetNumber += 1;
        }

        return Object.freeze({
            success: true,
            sheets: Object.freeze(generatedSheets),
            summary: Object.freeze({
                totalSheets: generatedSheets.length,
                totalPhotosPlaced,
                eventCount: 1,
                strategy
            })
        });
    }

    const eventGapMs = eventGapMinutes * 60 * 1000;
    const events = groupPhotosByEvent(chronologicalPhotos, eventGapMs);
    const photoIdMap = new Map(chronologicalPhotos.map(p => [String(p.id), p]));

    // If events empty (e.g. photos without timestamps), treat as one single event
    const eventList = events.length > 0 ? events : [{
        groupId: "event-1",
        photoIds: chronologicalPhotos.map(p => p.id)
    }];

    const generatedSheets = [];
    let sheetNumber = startIndex;
    let previousTemplateId = null;
    let totalPhotosPlaced = 0;

    for (let eventIdx = 0; eventIdx < eventList.length; eventIdx++) {
        const ev = eventList[eventIdx];
        const eventPhotos = ev.photoIds
            .map(id => photoIdMap.get(String(id)))
            .filter(Boolean);

        if (eventPhotos.length === 0) continue;

        // Partition event photos into spread photo chunks
        const chunks = [];

        if (strategy === AutoFlowStrategy.HERO_DYNAMIC) {
            let currentChunk = [];
            for (const photo of eventPhotos) {
                const qScore = getPhotoQualityScore(photo);
                // Standout hero photo gets a dedicated single spread
                if (qScore >= 85 && currentChunk.length === 0) {
                    chunks.push([photo]);
                } else {
                    currentChunk.push(photo);
                    if (currentChunk.length >= effectiveMaxPhotos) {
                        chunks.push(currentChunk);
                        currentChunk = [];
                    }
                }
            }
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }
        } else {
            // Chronological burst & balanced partition
            const bursts = groupPhotosByBurst(eventPhotos, 3000);
            const burstMap = new Map();
            for (const b of bursts) {
                for (const pid of b.photoIds) {
                    burstMap.set(String(pid), b.photoIds);
                }
            }

            let currentChunk = [];
            let i = 0;

            while (i < eventPhotos.length) {
                const photo = eventPhotos[i];
                const burstPhotoIds = burstMap.get(String(photo.id));

                if (burstPhotoIds && burstPhotoIds.length > 1 && burstPhotoIds.length <= effectiveMaxPhotos) {
                    // Try to place entire burst in one spread if fits
                    if (currentChunk.length > 0) {
                        chunks.push(currentChunk);
                        currentChunk = [];
                    }
                    const burstPhotos = burstPhotoIds
                        .map(id => photoIdMap.get(String(id)))
                        .filter(Boolean);
                    chunks.push(burstPhotos);
                    i += burstPhotos.length;
                } else {
                    currentChunk.push(photo);
                    if (currentChunk.length >= effectiveMaxPhotos) {
                        chunks.push(currentChunk);
                        currentChunk = [];
                    }
                    i += 1;
                }
            }

            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }
        }

        // Generate sheets for chunks
        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            const chunk = chunks[chunkIdx];
            if (chunk.length === 0) continue;

            const template = selectBestTemplate(templates, chunk.length, previousTemplateId);
            if (!template) continue;

            previousTemplateId = template.id;
            const slots = assignPhotosToTemplateSlots(chunk, template);
            totalPhotosPlaced += slots.length;

            const eventLabel = eventList.length > 1 ? `Chapter ${eventIdx + 1}` : "Spread";
            const sheetId = `${sheetPrefix}_${sheetNumber}`.replace(/[^A-Za-z0-9_-]/g, "_");

            generatedSheets.push(Object.freeze({
                id: sheetId,
                templateId: template.id,
                label: `${eventLabel} - Page ${chunkIdx + 1}`,
                slots
            }));

            sheetNumber += 1;
        }
    }

    return Object.freeze({
        success: true,
        sheets: Object.freeze(generatedSheets),
        summary: Object.freeze({
            totalSheets: generatedSheets.length,
            totalPhotosPlaced,
            eventCount: eventList.length,
            strategy
        })
    });
}
