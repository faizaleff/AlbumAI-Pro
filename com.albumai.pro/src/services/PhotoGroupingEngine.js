/**
 * Photo Grouping & Smart Intelligence Engine for AlbumAI Pro
 *
 * Provides:
 *   1. Burst & Event temporal clustering
 *   2. Multi-camera EXIF time sync and offset detection
 *   3. Universal venue / scene classification
 *   4. Costume & Haldi transition detection
 *   5. Smart wedding group orchestration
 *   6. Workflow state / wizard step tracking
 */

export const DEFAULT_BURST_THRESHOLD_MS = 3000; // 3 seconds
export const DEFAULT_EVENT_GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
export const PROFESSIONAL_CAMERA_MIN_PHOTOS = 20;
export const SUSPICIOUS_OFFSET_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export const COSTUME_CHANGE_DELTA_E_THRESHOLD = 35;
export const HALDI_YELLOW_HUE_MIN = 40;
export const HALDI_YELLOW_HUE_MAX = 65;
export const HALDI_MIN_SATURATION = 0.35;
export const HALDI_MIN_COVERAGE = 0.30;

export const SCENE_TYPES = Object.freeze({
    OUTDOOR:       "outdoor",
    INDOOR_SACRED: "indoor-sacred",
    INDOOR_WARM:   "indoor-warm",
    INTIMATE:      "intimate",
    EVENING:       "evening-event",
    STUDIO:        "studio",
    UNKNOWN:       "unknown"
});

export const SCENE_LABELS = Object.freeze({
    "outdoor":       "📍 Outdoor",
    "indoor-sacred": "📍 Sacred Venue",
    "indoor-warm":   "📍 Indoor Hall",
    "intimate":      "📍 Intimate Setting",
    "evening-event": "📍 Evening Event",
    "studio":        "📍 Studio / Portrait",
    "unknown":       "📍 Venue"
});

export const WIZARD_STEPS = Object.freeze([
    { id: 1, key: "IMPORT", icon: "📂", label: "Import", description: "Load Photos" },
    { id: 2, key: "SORT",   icon: "🗂",  label: "Sort",   description: "Smart Groups" },
    { id: 3, key: "CULL",   icon: "⭐",  label: "Cull",   description: "Select Best" },
    { id: 4, key: "DESIGN", icon: "🎨", label: "Design", description: "Album Layout" },
    { id: 5, key: "EXPORT", icon: "🖨",  label: "Export", description: "JPEG / PDF" }
]);

export const WIZARD_STEP_KEYS = Object.freeze({
    IMPORT: 1, SORT: 2, CULL: 3, DESIGN: 4, EXPORT: 5
});

export const ANALYSIS_STATUS = Object.freeze({
    IDLE: "IDLE",
    DETECTING_CAMERAS: "DETECTING_CAMERAS",
    SYNCING_TIMES: "SYNCING_TIMES",
    CLUSTERING_EVENTS: "CLUSTERING_EVENTS",
    ANALYZING_SCENES: "ANALYZING_SCENES",
    DETECTING_COSTUMES: "DETECTING_COSTUMES",
    MERGING: "MERGING",
    DONE: "DONE",
    ERROR: "ERROR"
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
        if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
        if (typeof val === "string" && val.trim().length > 0) {
            const parsed = new Date(val).getTime();
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
    }
    return 0;
}

function getPhotoQualityScore(photo) {
    if (!photo) return 0;
    return photo.aiAnalysis?.aggregate?.rankScore || photo.rating || 0;
}

/* ═══════════════════════════════════════════════════════
   1. BURST & EVENT CLUSTERING
═══════════════════════════════════════════════════════ */

export function groupPhotosByBurst(photos = [], burstThresholdMs = DEFAULT_BURST_THRESHOLD_MS) {
    if (!Array.isArray(photos) || photos.length === 0) return Object.freeze([]);

    const indexed = photos.map((photo, idx) => ({
        photo,
        id: photo.id || `photo-${idx}`,
        timestamp: getPhotoTimestamp(photo),
        qualityScore: getPhotoQualityScore(photo),
        originalIndex: idx
    }));

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

export function groupPhotosByEvent(photos = [], eventGapThresholdMs = DEFAULT_EVENT_GAP_THRESHOLD_MS) {
    if (!Array.isArray(photos) || photos.length === 0) return Object.freeze([]);

    const indexed = photos.map((photo, idx) => ({
        photo,
        id: photo.id || `photo-${idx}`,
        timestamp: getPhotoTimestamp(photo),
        originalIndex: idx
    }));

    const withTime = indexed.filter(p => p.timestamp > 0);
    withTime.sort((a, b) => a.timestamp - b.timestamp || a.originalIndex - b.originalIndex);

    if (withTime.length === 0) return Object.freeze([]);

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

/* ═══════════════════════════════════════════════════════
   2. MULTI-CAMERA TIME SYNC
═══════════════════════════════════════════════════════ */

const PHONE_KEYWORDS = ["iphone", "samsung", "pixel", "oneplus", "xiaomi", "oppo", "vivo", "huawei", "realme"];

function getCameraKey(photo) {
    const make = (photo.metadata?.cameraMake || photo.cameraMake || "").toLowerCase().trim();
    const model = (photo.metadata?.cameraModel || photo.cameraModel || "").toLowerCase().trim();
    if (!make && !model) return "unknown";
    return `${make}|${model}`;
}

function getCameraLabel(photo) {
    const make = (photo.metadata?.cameraMake || photo.cameraMake || "").trim();
    const model = (photo.metadata?.cameraModel || photo.cameraModel || "").trim();
    if (make && model) return `${make} ${model}`;
    return make || model || "Primary Camera";
}

export function detectCameras(photos = []) {
    const map = new Map();
    for (const photo of photos) {
        const key = getCameraKey(photo);
        const label = getCameraLabel(photo);
        const ts = getPhotoTimestamp(photo);
        const lower = label.toLowerCase();
        const isPhone = PHONE_KEYWORDS.some(kw => lower.includes(kw));

        if (!map.has(key)) {
            map.set(key, {
                cameraKey: key,
                label,
                isPhone,
                photoCount: 0,
                timestamps: []
            });
        }
        const entry = map.get(key);
        entry.photoCount += 1;
        if (ts > 0) entry.timestamps.push(ts);
    }
    return [...map.values()].sort((a, b) => b.photoCount - a.photoCount);
}

export function findAnchorCamera(cameras = []) {
    const pros = cameras.filter(c => !c.isPhone && c.photoCount >= PROFESSIONAL_CAMERA_MIN_PHOTOS);
    if (pros.length > 0) return pros[0];
    const nonPhone = cameras.filter(c => !c.isPhone);
    if (nonPhone.length > 0) return nonPhone[0];
    return cameras[0] || null;
}

export function calculateCameraOffsets(photos = [], anchorCameraKey) {
    const cameras = detectCameras(photos);
    const anchor = cameras.find(c => c.cameraKey === anchorCameraKey) || findAnchorCamera(cameras);
    if (!anchor) return [];

    const anchorPhotos = photos.filter(p => getCameraKey(p) === anchor.cameraKey && getPhotoTimestamp(p) > 0);
    anchorPhotos.sort((a, b) => getPhotoTimestamp(a) - getPhotoTimestamp(b));

    const results = [];
    for (const cam of cameras) {
        if (cam.cameraKey === anchor.cameraKey) {
            results.push({ ...cam, offsetMs: 0, confidence: 100, suspicious: false });
            continue;
        }

        const camPhotos = photos.filter(p => getCameraKey(p) === cam.cameraKey && getPhotoTimestamp(p) > 0);
        if (camPhotos.length === 0) {
            results.push({ ...cam, offsetMs: 0, confidence: 0, suspicious: false });
            continue;
        }

        const offsets = [];
        for (const anchorPhoto of anchorPhotos) {
            const anchorTs = getPhotoTimestamp(anchorPhoto);
            const nearby = camPhotos.filter(p => Math.abs(getPhotoTimestamp(p) - anchorTs) < 24 * 60 * 60 * 1000);
            for (const near of nearby.slice(0, 3)) {
                offsets.push(getPhotoTimestamp(near) - anchorTs);
            }
        }

        if (offsets.length === 0) {
            results.push({ ...cam, offsetMs: 0, confidence: 0, suspicious: false });
            continue;
        }

        offsets.sort((a, b) => a - b);
        const medianOffset = offsets[Math.floor(offsets.length / 2)];
        const suspicious = Math.abs(medianOffset) > SUSPICIOUS_OFFSET_THRESHOLD_MS;
        const confidence = Math.min(100, Math.round((offsets.length / 10) * 100));

        results.push({
            ...cam,
            offsetMs: medianOffset,
            confidence,
            suspicious
        });
    }

    return results;
}

export function applyTimestampOffsets(photos = [], offsetMap = new Map()) {
    if (!offsetMap || offsetMap.size === 0) return photos;
    return photos.map(photo => {
        const key = getCameraKey(photo);
        const offset = offsetMap.get(key);
        if (!offset) return photo;
        const originalTs = getPhotoTimestamp(photo);
        if (!originalTs) return photo;
        return {
            ...photo,
            metadata: {
                ...(photo.metadata || {}),
                dateTaken: originalTs - offset,
                _timeCorrected: true,
                _originalTimestamp: originalTs,
                _cameraOffset: offset
            }
        };
    });
}

export function formatOffset(offsetMs) {
    if (!offsetMs) return "No offset";
    const abs = Math.abs(offsetMs);
    const sign = offsetMs < 0 ? "−" : "+";
    const hours = Math.floor(abs / (60 * 60 * 1000));
    const mins = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0 && mins > 0) return `${sign}${hours} hr ${mins} min`;
    if (hours > 0) return `${sign}${hours} hr`;
    return `${sign}${mins} min`;
}

/* ═══════════════════════════════════════════════════════
   3. SCENE & VENUE CLASSIFICATION
═══════════════════════════════════════════════════════ */

export function analyzeScene(pixelData, width, height) {
    if (!pixelData || !width || !height) {
        return { brightness: 0, colorTemp: "unknown", skyScore: 0, uniformity: 0, sceneType: SCENE_TYPES.UNKNOWN };
    }

    const totalPixels = width * height;
    let totalLuminance = 0;
    for (let i = 0; i < pixelData.length; i += 4) {
        totalLuminance += 0.2126 * pixelData[i] + 0.7152 * pixelData[i + 1] + 0.0722 * pixelData[i + 2];
    }
    const brightness = totalLuminance / totalPixels;

    const skyRows = Math.floor(height * 0.20);
    let blueDominantCount = 0;
    let skyPixelCount = 0;
    for (let y = 0; y < skyRows; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixelData[idx], g = pixelData[idx + 1], b = pixelData[idx + 2];
            if (b > r + 20 && b > g + 10 && b > 100) blueDominantCount++;
            skyPixelCount++;
        }
    }
    const skyScore = skyPixelCount > 0 ? blueDominantCount / skyPixelCount : 0;

    let totalR = 0, totalB = 0;
    for (let i = 0; i < pixelData.length; i += 4) {
        totalR += pixelData[i];
        totalB += pixelData[i + 2];
    }
    const avgR = totalR / totalPixels;
    const avgB = totalB / totalPixels;
    let colorTemp;
    if (avgR > avgB + 25) colorTemp = "warm";
    else if (avgB > avgR + 15) colorTemp = "cool";
    else colorTemp = "neutral";

    let sumDiffSq = 0;
    const step = 4 * 3;
    let sampleCount = 0;
    for (let i = 0; i < pixelData.length; i += step) {
        const lum = 0.2126 * pixelData[i] + 0.7152 * pixelData[i + 1] + 0.0722 * pixelData[i + 2];
        sumDiffSq += Math.pow(lum - brightness, 2);
        sampleCount++;
    }
    const uniformity = sampleCount > 0 ? 1 - Math.min(1, Math.sqrt(sumDiffSq / sampleCount) / 80) : 0;

    let sceneType = SCENE_TYPES.INDOOR_WARM;
    if (uniformity > 0.85 && brightness > 60) sceneType = SCENE_TYPES.STUDIO;
    else if (brightness > 150 && skyScore > 0.25) sceneType = SCENE_TYPES.OUTDOOR;
    else if (brightness < 80) sceneType = SCENE_TYPES.EVENING;
    else if (brightness > 140 && colorTemp === "cool") sceneType = SCENE_TYPES.OUTDOOR;
    else if (brightness >= 80 && brightness <= 160 && colorTemp !== "warm" && uniformity > 0.4) {
        sceneType = SCENE_TYPES.INDOOR_SACRED;
    } else if (colorTemp === "warm" && brightness > 80) {
        sceneType = SCENE_TYPES.INDOOR_WARM;
    } else if (brightness < 130 && uniformity < 0.4) {
        sceneType = SCENE_TYPES.INTIMATE;
    }

    return { brightness, colorTemp, skyScore, uniformity, sceneType };
}

/* ═══════════════════════════════════════════════════════
   4. COSTUME & HALDI TRANSITIONS
═══════════════════════════════════════════════════════ */

export function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h: h * 360, s, l };
}

export function labelColor(rgb) {
    const [r, g, b] = rgb || [128, 128, 128];
    const { h, s, l } = rgbToHsl(r, g, b);
    if (l < 0.15) return "Black";
    if (l > 0.88) return "White / Cream";
    if (s < 0.15) return "Gray / Silver";
    if (h >= 0   && h < 20)  return "Red";
    if (h >= 20  && h < 40)  return "Orange";
    if (h >= 40  && h < 65)  return "Yellow / Gold";
    if (h >= 65  && h < 155) return "Green";
    if (h >= 155 && h < 195) return "Teal / Cyan";
    if (h >= 195 && h < 255) return "Blue";
    if (h >= 255 && h < 290) return "Purple / Violet";
    if (h >= 290 && h < 330) return "Pink / Magenta";
    if (h >= 330 && h < 355) return "Deep Red / Maroon";
    return "Red";
}

/* ═══════════════════════════════════════════════════════
   5. WORKFLOW STATE / WIZARD STEP HELPERS
═══════════════════════════════════════════════════════ */

export function computeCompletedSteps({
    photoCount = 0,
    analysisComplete = false,
    groupsReviewed = false,
    keptPhotoCount = 0,
    placedPhotoCount = 0,
    exportComplete = false
} = {}) {
    const completed = new Set();
    if (photoCount > 0 && analysisComplete) completed.add(1);
    if (completed.has(1) && groupsReviewed)  completed.add(2);
    if (completed.has(2) && keptPhotoCount > 0) completed.add(3);
    if (completed.has(3) && placedPhotoCount > 0) completed.add(4);
    if (completed.has(4) && exportComplete)  completed.add(5);
    return Object.freeze(completed);
}

export function canNavigateToStep(currentStep, targetStep, completedSteps) {
    if (targetStep < 1 || targetStep > 5) return false;
    if (targetStep <= currentStep) return true;
    const maxUnlocked = Math.max(...[...(completedSteps || [])], 0) + 1;
    return targetStep <= maxUnlocked;
}

export function stepLockedReason(targetStep, completedSteps) {
    if (completedSteps?.has(targetStep - 1) || targetStep === 1) return null;
    const reasons = {
        2: "Import photos first to enable smart grouping.",
        3: "Review your photo groups before culling.",
        4: "Select at least 1 photo to keep before designing.",
        5: "Place photos in the album layout before exporting."
    };
    return reasons[targetStep] || null;
}

export function resolveWizardNavigation({
    currentStep = 1,
    targetStep,
    completedSteps,
    hasProject = false,
    photoCount = 0,
    directDesignerEntry = false
} = {}) {
    if (directDesignerEntry) {
        return Boolean(hasProject && photoCount > 0 && targetStep === 4);
    }
    return canNavigateToStep(currentStep, targetStep, completedSteps);
}

export function workspaceModeForWizardStep(stepId) {
    const step = Number(stepId);
    if (step >= 1 && step <= 3) return "LIBRARY";
    if (step === 4) return "DESIGNER";
    if (step === 5) return "EXPORT";
    return "LIBRARY";
}
