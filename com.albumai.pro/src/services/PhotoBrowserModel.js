export const PHOTO_BROWSER_PREFERENCES_SCHEMA = 1;
export const PHOTO_DECISIONS_SCHEMA = 1;
export const PHOTO_STORY_ORDER_SCHEMA = 1;
export const PHOTO_EVENT_CHAPTERS_SCHEMA = 1;

const SORT_FIELDS = new Set([
    "name",
    "modified",
    "taken",
    "created",
    "rating",
    "size",
    "quality",
    "manual"
]);
const ORIENTATIONS = new Set([
    "landscape",
    "portrait",
    "square",
    "unknown"
]);
const DATE_PRESETS = new Set([
    "any",
    "today",
    "last7",
    "last30",
    "thisYear"
]);
const DATE_FIELDS = new Set([
    "modified",
    "taken",
    "created"
]);
const RATING_COMPARISONS = new Set(["exact", "above", "below"]);
const COLOR_LABELS = new Set([6, 7, 8]);
const MAX_SEARCH_LENGTH = 160;
const MAX_PHOTO_DECISIONS = 20000;
const MAX_EVENT_CHAPTERS = 200;
const MAX_EVENT_CHAPTER_NAME_LENGTH = 80;
const DAY_MS = 24 * 60 * 60 * 1000;

function boundedString(value, maximum = MAX_SEARCH_LENGTH) {
    return typeof value === "string"
        ? value.trim().slice(0, maximum)
        : "";
}

function normalizedList(value, allowed = null) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value
        .map(item => boundedString(item, 24).toLowerCase())
        .filter(item => item && (!allowed || allowed.has(item))))]
        .sort();
}

function normalizedRating(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(5, Math.floor(number)));
}

function normalizedColorLabel(value) {
    const number = Number(value);
    return COLOR_LABELS.has(number) ? number : 0;
}

function fnv1a(value, seed) {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

export function photoDecisionKey(photo) {
    const source = photo?.file?.nativePath || photo?.id || photo?.name;
    if (typeof source !== "string" || !source) return null;
    const normalized = source.normalize
        ? source.normalize("NFC")
        : source;
    return `p1-${fnv1a(normalized, 0x811c9dc5)}${fnv1a(
        normalized,
        0x9e3779b9
    )}`;
}

export function normalizePhotoStoryOrder(value = {}, photos = null) {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const items = [];
    const seen = new Set();
    for (const key of Array.isArray(source.items)
        ? source.items.slice(0, MAX_PHOTO_DECISIONS)
        : []) {
        if (!/^p1-[0-9a-f]{16}$/.test(key || "") || seen.has(key)) continue;
        seen.add(key);
        items.push(key);
    }
    if (Array.isArray(photos)) {
        const available = new Set(photos.map(photoDecisionKey).filter(Boolean));
        const reconciled = items.filter(key => available.has(key));
        const reconciledSet = new Set(reconciled);
        for (const photo of photos) {
            const key = photoDecisionKey(photo);
            if (!key || reconciledSet.has(key)) continue;
            reconciledSet.add(key);
            reconciled.push(key);
        }
        return Object.freeze({
            schemaVersion: PHOTO_STORY_ORDER_SCHEMA,
            items: Object.freeze(reconciled)
        });
    }
    return Object.freeze({
        schemaVersion: PHOTO_STORY_ORDER_SCHEMA,
        items: Object.freeze(items)
    });
}

export function applyPhotoStoryOrder(photos = [], value = {}) {
    const source = Array.isArray(photos) ? photos : [];
    const order = normalizePhotoStoryOrder(value, source);
    const rank = new Map(order.items.map((key, index) => [key, index]));
    return Object.freeze(source.slice().sort((left, right) =>
        rank.get(photoDecisionKey(left)) - rank.get(photoDecisionKey(right))
    ));
}

export function movePhotosInStoryOrder(
    value,
    photos = [],
    sourcePhoto,
    targetPhoto,
    selectedPhotos = []
) {
    const ordered = applyPhotoStoryOrder(photos, value);
    const sourceKey = photoDecisionKey(sourcePhoto);
    const targetKey = photoDecisionKey(targetPhoto);
    const keys = ordered.map(photoDecisionKey).filter(Boolean);
    if (!sourceKey || !targetKey || sourceKey === targetKey) {
        return normalizePhotoStoryOrder({ items: keys }, ordered);
    }
    if (!keys.includes(sourceKey) || !keys.includes(targetKey)) {
        return normalizePhotoStoryOrder({ items: keys }, ordered);
    }
    const selectedKeys = new Set(selectedPhotos
        .map(photoDecisionKey)
        .filter(key => keys.includes(key)));
    const moving = selectedKeys.has(sourceKey)
        ? keys.filter(key => selectedKeys.has(key))
        : [sourceKey];
    if (moving.includes(targetKey)) {
        return normalizePhotoStoryOrder({ items: keys }, ordered);
    }
    const movingSet = new Set(moving);
    const remaining = keys.filter(key => !movingSet.has(key));
    const targetIndex = remaining.indexOf(targetKey);
    remaining.splice(targetIndex, 0, ...moving);
    return normalizePhotoStoryOrder({ items: remaining }, ordered);
}

function normalizedEventChapterName(value, fallback) {
    const name = boundedString(value, MAX_EVENT_CHAPTER_NAME_LENGTH);
    return name || fallback;
}

export function normalizePhotoEventChapters(value = {}, photos = null) {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const available = Array.isArray(photos)
        ? new Set(photos.map(photoDecisionKey).filter(Boolean))
        : null;
    const claimedPhotoKeys = new Set();
    const seenChapterIds = new Set();
    const items = [];

    for (const candidate of Array.isArray(source.items)
        ? source.items.slice(0, MAX_EVENT_CHAPTERS)
        : []) {
        const chapterId = typeof candidate?.chapterId === "string"
            ? candidate.chapterId.trim()
            : "";
        if (!/^chapter-[1-9][0-9]{0,5}$/.test(chapterId) ||
            seenChapterIds.has(chapterId)) continue;
        seenChapterIds.add(chapterId);

        const photoKeys = [];
        for (const photoKey of Array.isArray(candidate.photoKeys)
            ? candidate.photoKeys.slice(0, MAX_PHOTO_DECISIONS)
            : []) {
            if (!/^p1-[0-9a-f]{16}$/.test(photoKey || "") ||
                claimedPhotoKeys.has(photoKey) ||
                (available && !available.has(photoKey))) continue;
            claimedPhotoKeys.add(photoKey);
            photoKeys.push(photoKey);
        }
        items.push(Object.freeze({
            chapterId,
            name: normalizedEventChapterName(
                candidate.name,
                `Event ${items.length + 1}`
            ),
            photoKeys: Object.freeze(photoKeys)
        }));
    }

    return Object.freeze({
        schemaVersion: PHOTO_EVENT_CHAPTERS_SCHEMA,
        items: Object.freeze(items)
    });
}

export function createPhotoEventChapter(value, selectedPhotos = [], photos = null) {
    const current = normalizePhotoEventChapters(value, photos);
    const nextNumber = current.items.reduce((maximum, item) => {
        const number = Number(item.chapterId.slice("chapter-".length));
        return Math.max(maximum, Number.isFinite(number) ? number : 0);
    }, 0) + 1;
    const chapterId = `chapter-${nextNumber}`;
    const selectedKeys = new Set(selectedPhotos.map(photoDecisionKey).filter(Boolean));
    const items = current.items.map(item => ({
        ...item,
        photoKeys: item.photoKeys.filter(key => !selectedKeys.has(key))
    }));
    items.push({
        chapterId,
        name: `Event ${items.length + 1}`,
        photoKeys: [...selectedKeys]
    });
    return normalizePhotoEventChapters({ items }, photos);
}

export function renamePhotoEventChapter(value, chapterId, name, photos = null) {
    const current = normalizePhotoEventChapters(value, photos);
    return normalizePhotoEventChapters({
        items: current.items.map((item, index) => item.chapterId === chapterId
            ? {
                ...item,
                name: normalizedEventChapterName(name, `Event ${index + 1}`)
            }
            : item)
    }, photos);
}

export function movePhotoEventChapter(value, chapterId, direction, photos = null) {
    const current = normalizePhotoEventChapters(value, photos);
    const items = current.items.map(item => ({ ...item, photoKeys: [...item.photoKeys] }));
    const sourceIndex = items.findIndex(item => item.chapterId === chapterId);
    const delta = direction === "up" || Number(direction) < 0 ? -1 : 1;
    const targetIndex = sourceIndex + delta;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= items.length) {
        return current;
    }
    const [moved] = items.splice(sourceIndex, 1);
    items.splice(targetIndex, 0, moved);
    return normalizePhotoEventChapters({ items }, photos);
}

export function deleteEmptyPhotoEventChapter(value, chapterId, photos = null) {
    const current = normalizePhotoEventChapters(value, photos);
    const chapter = current.items.find(item => item.chapterId === chapterId);
    if (!chapter || chapter.photoKeys.length) return current;
    return normalizePhotoEventChapters({
        items: current.items.filter(item => item.chapterId !== chapterId)
    }, photos);
}

export function mergePhotoEventChapters(
    value,
    sourceChapterId,
    targetChapterId,
    photos = null
) {
    const current = normalizePhotoEventChapters(value, photos);
    if (sourceChapterId === targetChapterId) return current;
    const source = current.items.find(item => item.chapterId === sourceChapterId);
    const target = current.items.find(item => item.chapterId === targetChapterId);
    if (!source || !target) return current;
    return normalizePhotoEventChapters({
        items: current.items
            .filter(item => item.chapterId !== sourceChapterId)
            .map(item => item.chapterId === targetChapterId
                ? { ...item, photoKeys: [...item.photoKeys, ...source.photoKeys] }
                : item)
    }, photos);
}

export function assignPhotosToEventChapter(
    value,
    chapterId,
    selectedPhotos = [],
    photos = null
) {
    const current = normalizePhotoEventChapters(value, photos);
    if (!current.items.some(item => item.chapterId === chapterId)) return current;
    const selectedKeys = new Set(selectedPhotos.map(photoDecisionKey).filter(Boolean));
    return normalizePhotoEventChapters({
        items: current.items.map(item => ({
            ...item,
            photoKeys: [
                ...item.photoKeys.filter(key => !selectedKeys.has(key)),
                ...(item.chapterId === chapterId ? selectedKeys : [])
            ]
        }))
    }, photos);
}

export function removePhotosFromEventChapters(
    value,
    selectedPhotos = [],
    photos = null
) {
    const current = normalizePhotoEventChapters(value, photos);
    const selectedKeys = new Set(selectedPhotos.map(photoDecisionKey).filter(Boolean));
    if (!selectedKeys.size) return current;
    return normalizePhotoEventChapters({
        items: current.items.map(item => ({
            ...item,
            photoKeys: item.photoKeys.filter(key => !selectedKeys.has(key))
        }))
    }, photos);
}

export function findUnassignedPhotoEventChapterPhotos(value, photos = []) {
    const availablePhotos = Array.isArray(photos) ? photos : [];
    const current = normalizePhotoEventChapters(value, availablePhotos);
    const assignedKeys = new Set(current.items.flatMap(item => item.photoKeys));
    return Object.freeze(availablePhotos.filter(
        photo => !assignedKeys.has(photoDecisionKey(photo))
    ));
}

export function summarizePhotoEventChapterReview(value, photos = []) {
    const availablePhotos = Array.isArray(photos) ? photos : [];
    const current = normalizePhotoEventChapters(value, availablePhotos);
    const unassignedCount = findUnassignedPhotoEventChapterPhotos(
        current,
        availablePhotos
    ).length;
    const manual = current.items.length > 0;
    return Object.freeze({
        ready: availablePhotos.length > 0 && (!manual || unassignedCount === 0),
        manual,
        chapterCount: current.items.length,
        assignedCount: availablePhotos.length - unassignedCount,
        unassignedCount
    });
}

function normalizedDecision(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const photoKey = typeof item.photoKey === "string" &&
        /^p1-[0-9a-f]{16}$/.test(item.photoKey)
        ? item.photoKey
        : null;
    if (!photoKey) return null;
    const rating = normalizedRating(item.rating);
    const favorite = item.favorite === true;
    const colorLabel = normalizedColorLabel(item.colorLabel);
    const culling = typeof item.culling === "string" && ["KEEP", "REJECT"].includes(item.culling.toUpperCase())
        ? item.culling.toUpperCase()
        : null;
    if (!rating && !favorite && !colorLabel && !culling) return null;
    const result = { photoKey, rating, favorite };
    if (colorLabel) result.colorLabel = colorLabel;
    if (culling) result.culling = culling;
    return Object.freeze(result);
}

export function normalizePhotoDecisions(value = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const byKey = new Map();
    if (Array.isArray(source.items)) {
        for (const candidate of source.items.slice(0, MAX_PHOTO_DECISIONS)) {
            const decision = normalizedDecision(candidate);
            if (decision) byKey.set(decision.photoKey, decision);
        }
    }
    const items = [...byKey.values()]
        .sort((left, right) => left.photoKey.localeCompare(right.photoKey));
    return Object.freeze({
        schemaVersion: PHOTO_DECISIONS_SCHEMA,
        items: Object.freeze(items)
    });
}

function photoDecisionMap(value) {
    const decisions = normalizePhotoDecisions(value);
    return new Map(decisions.items.map(item => [item.photoKey, item]));
}

function effectivePhotoDecision(photo, decisionsByKey) {
    const persisted = decisionsByKey.get(photoDecisionKey(photo));
    return persisted || {
        rating: normalizedRating(photo?.rating),
        favorite: photo?.favorite === true,
        colorLabel: normalizedColorLabel(photo?.colorLabel)
    };
}

export function photoDecisionFor(value, photo) {
    const decision = effectivePhotoDecision(photo, photoDecisionMap(value));
    const result = {
        rating: decision.rating,
        favorite: decision.favorite
    };
    if (decision.colorLabel) result.colorLabel = decision.colorLabel;
    if (decision.culling && decision.culling !== "UNRATED") {
        result.culling = decision.culling;
    }
    return Object.freeze(result);
}

export function createPhotoDecisionLookup(value = {}) {
    const decisionsByKey = photoDecisionMap(value);
    return photo => {
        const decision = effectivePhotoDecision(photo, decisionsByKey);
        const result = {
            rating: decision.rating,
            favorite: decision.favorite
        };
        if (decision.colorLabel) result.colorLabel = decision.colorLabel;
        if (decision.culling && decision.culling !== "UNRATED") {
            result.culling = decision.culling;
        }
        return Object.freeze(result);
    };
}

export function updatePhotoDecision(value, photo, changes = {}) {
    const photoKey = photoDecisionKey(photo);
    const current = normalizePhotoDecisions(value);
    if (!photoKey) return current;
    const byKey = new Map(current.items.map(item => [item.photoKey, item]));
    const previous = byKey.get(photoKey) || { rating: 0, favorite: false, colorLabel: 0 };
    const rating = Object.prototype.hasOwnProperty.call(changes, "rating")
        ? normalizedRating(changes.rating)
        : previous.rating;
    const favorite = Object.prototype.hasOwnProperty.call(changes, "favorite")
        ? changes.favorite === true
        : previous.favorite;
    const colorLabel = Object.prototype.hasOwnProperty.call(changes, "colorLabel")
        ? normalizedColorLabel(changes.colorLabel)
        : (previous.colorLabel || 0);
    const culling = Object.prototype.hasOwnProperty.call(changes, "culling")
        ? (typeof changes.culling === "string" && ["KEEP", "REJECT"].includes(changes.culling.toUpperCase())
            ? changes.culling.toUpperCase()
            : null)
        : (previous.culling || null);
    if (!rating && !favorite && !colorLabel && !culling) byKey.delete(photoKey);
    else {
        const next = { photoKey, rating, favorite };
        if (colorLabel) next.colorLabel = colorLabel;
        if (culling) next.culling = culling;
        byKey.set(photoKey, next);
    }
    return normalizePhotoDecisions({ items: [...byKey.values()] });
}

export function reconcilePhotoDecisions(value, photos = []) {
    const current = normalizePhotoDecisions(value);
    const available = new Set((Array.isArray(photos) ? photos : [])
        .map(photoDecisionKey)
        .filter(Boolean));
    return normalizePhotoDecisions({
        items: current.items.filter(item => available.has(item.photoKey))
    });
}

export function normalizePhotoBrowserPreferences(value = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const sortSource = source.sort && typeof source.sort === "object"
        ? source.sort
        : source;

    return Object.freeze({
        schemaVersion: PHOTO_BROWSER_PREFERENCES_SCHEMA,
        search: boundedString(source.search),
        types: Object.freeze(normalizedList(source.types)),
        orientations: Object.freeze(normalizedList(
            source.orientations,
            ORIENTATIONS
        )),
        minimumRating: normalizedRating(source.minimumRating),
        ratingFilterActive: source.ratingFilterActive === true,
        ratingValue: normalizedRating(source.ratingValue),
        ratingComparison: RATING_COMPARISONS.has(source.ratingComparison)
            ? source.ratingComparison
            : "exact",
        colorLabel: normalizedColorLabel(source.colorLabel),
        favoritesOnly: source.favoritesOnly === true,
        duplicatesOnly: source.duplicatesOnly === true,
        datePreset: DATE_PRESETS.has(source.datePreset)
            ? source.datePreset
            : "any",
        dateField: DATE_FIELDS.has(source.dateField)
            ? source.dateField
            : "modified",
        sort: Object.freeze({
            field: SORT_FIELDS.has(sortSource.field)
                ? sortSource.field
                : "name",
            direction: sortSource.direction === "desc" ? "desc" : "asc"
        })
    });
}

export function photoOrientation(photo) {
    const published = typeof photo?.orientation === "string"
        ? photo.orientation.toLowerCase()
        : "";
    if (ORIENTATIONS.has(published) && published !== "unknown") {
        return published;
    }

    const width = Number(photo?.width);
    const height = Number(photo?.height);
    if (!(width > 0) || !(height > 0)) return "unknown";
    if (width === height) return "square";
    return width > height ? "landscape" : "portrait";
}

function photoExtension(photo) {
    const published = boundedString(photo?.extension, 24).toLowerCase();
    if (published) return published;
    const name = boundedString(photo?.name, 260);
    const index = name.lastIndexOf(".");
    return index < 0 ? "" : name.slice(index + 1).toLowerCase();
}

function dateValue(photo, field) {
    let value;
    if (field === "taken") {
        value = photo?.dateTaken || photo?.exif?.dateTaken;
    } else if (field === "created") {
        value = photo?.created || photo?.file?.created;
    } else {
        value = photo?.modified || photo?.file?.modified;
    }
    const milliseconds = value instanceof Date
        ? value.getTime()
        : new Date(value || 0).getTime();
    return Number.isFinite(milliseconds) && milliseconds > 0
        ? milliseconds
        : null;
}

function dateRange(preset, now) {
    if (preset === "any") return null;
    const end = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const current = new Date(end);
    if (preset === "today") {
        current.setHours(0, 0, 0, 0);
        return { start: current.getTime(), end };
    }
    if (preset === "thisYear") {
        current.setMonth(0, 1);
        current.setHours(0, 0, 0, 0);
        return { start: current.getTime(), end };
    }
    return {
        start: end - (preset === "last7" ? 7 : 30) * DAY_MS,
        end
    };
}

function nameComparison(left, right) {
    const leftName = String(left?.name || "");
    const rightName = String(right?.name || "");
    const natural = leftName.localeCompare(rightName, undefined, {
        numeric: true,
        sensitivity: "base"
    });
    if (natural) return natural;
    const exact = leftName.localeCompare(rightName);
    if (exact) return exact;
    return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function sortValue(photo, field, decisionsByKey) {
    if (field === "rating") {
        return effectivePhotoDecision(photo, decisionsByKey).rating;
    }
    if (field === "quality") {
        const quality = photo?.aiAnalysis?.aggregate?.rankScore ?? photo?.qualityScore;
        return typeof quality === "number" && Number.isFinite(quality) ? quality : null;
    }
    if (field === "size") {
        const size = Number(photo?.fileSize || photo?.file?.size);
        return Number.isFinite(size) && size >= 0 ? size : null;
    }
    if (field === "modified" || field === "taken" || field === "created") {
        return dateValue(photo, field);
    }
    return null;
}

function comparePhotos(left, right, sort, decisionsByKey) {
    if (sort.field === "name") {
        const result = nameComparison(left, right);
        return sort.direction === "desc" ? -result : result;
    }

    const leftValue = sortValue(left, sort.field, decisionsByKey);
    const rightValue = sortValue(right, sort.field, decisionsByKey);
    if (leftValue == null && rightValue == null) {
        return nameComparison(left, right);
    }
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    if (leftValue === rightValue) return nameComparison(left, right);
    const result = leftValue < rightValue ? -1 : 1;
    return sort.direction === "desc" ? -result : result;
}

function duplicatePhotoKeys(value) {
    const keys = new Set();
    if (!value || typeof value !== "object" || !Array.isArray(value.groups)) {
        return keys;
    }
    for (const group of value.groups) {
        if (!Array.isArray(group?.members)) continue;
        for (const member of group.members) {
            if (/^p1-[0-9a-f]{16}$/.test(member?.photoKey || "")) {
                keys.add(member.photoKey);
            }
        }
    }
    return keys;
}

function duplicateEvidenceIsReady(value) {
    return value?.status === "COMPLETE" || value?.status === "PARTIAL";
}

function matchesPhoto(
    photo,
    preferences,
    range,
    decisionsByKey,
    duplicateKeys,
    duplicateFilterAvailable
) {
    if (!photo || typeof photo !== "object") return false;
    if (preferences.search) {
        const query = preferences.search.toLocaleLowerCase();
        if (!String(photo.name || "").toLocaleLowerCase().includes(query)) {
            return false;
        }
    }
    if (
        preferences.types.length &&
        !preferences.types.includes(photoExtension(photo))
    ) return false;
    if (
        preferences.orientations.length &&
        !preferences.orientations.includes(photoOrientation(photo))
    ) return false;
    const decision = effectivePhotoDecision(photo, decisionsByKey);
    if (preferences.ratingFilterActive) {
        const ratingMatch = preferences.ratingComparison === "above"
            ? decision.rating >= preferences.ratingValue
            : preferences.ratingComparison === "below"
                ? decision.rating <= preferences.ratingValue
                : decision.rating === preferences.ratingValue;
        if (!ratingMatch) return false;
    } else if (decision.rating < preferences.minimumRating) return false;
    if (preferences.colorLabel && decision.colorLabel !== preferences.colorLabel) return false;
    if (preferences.favoritesOnly && !decision.favorite) return false;
    if (
        preferences.duplicatesOnly &&
        duplicateFilterAvailable &&
        !duplicateKeys.has(photoDecisionKey(photo))
    ) return false;
    if (range) {
        const milliseconds = dateValue(photo, preferences.dateField);
        if (milliseconds == null || milliseconds < range.start || milliseconds > range.end) {
            return false;
        }
    }
    return true;
}

export function queryPhotoBrowser(
    photos = [],
    value = {},
    { now, decisions = {}, duplicateEvidence = {} } = {}
) {
    const source = Array.isArray(photos) ? photos : [];
    const preferences = normalizePhotoBrowserPreferences(value);
    const decisionsByKey = photoDecisionMap(decisions);
    const duplicateKeys = duplicatePhotoKeys(duplicateEvidence);
    const duplicateFilterAvailable = duplicateEvidenceIsReady(
        duplicateEvidence
    );
    const range = dateRange(preferences.datePreset, now);
    const matched = source
        .filter(photo => matchesPhoto(
            photo,
            preferences,
            range,
            decisionsByKey,
            duplicateKeys,
            duplicateFilterAvailable
        ))
        .slice();
    if (preferences.sort.field !== "manual") {
        matched.sort((left, right) => comparePhotos(
            left,
            right,
            preferences.sort,
            decisionsByKey
        ));
    }
    const types = [...new Set(source.map(photoExtension).filter(Boolean))].sort();
    const orientations = [...new Set(source.map(photoOrientation))].sort();

    return Object.freeze({
        photos: Object.freeze(matched),
        preferences,
        counts: Object.freeze({
            total: source.length,
            matched: matched.length,
            hidden: source.length - matched.length
        }),
        facets: Object.freeze({
            types: Object.freeze(types),
            orientations: Object.freeze(orientations)
        })
    });
}

export function hasActivePhotoBrowserFilters(value = {}) {
    const preferences = normalizePhotoBrowserPreferences(value);
    return Boolean(
        preferences.search ||
        preferences.types.length ||
        preferences.orientations.length ||
        preferences.minimumRating ||
        preferences.ratingFilterActive ||
        preferences.colorLabel ||
        preferences.favoritesOnly ||
        preferences.duplicatesOnly ||
        preferences.datePreset !== "any"
    );
}
