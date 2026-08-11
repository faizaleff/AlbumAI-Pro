export const PHOTO_BROWSER_PREFERENCES_SCHEMA = 1;
export const PHOTO_DECISIONS_SCHEMA = 1;

const SORT_FIELDS = new Set([
    "name",
    "modified",
    "taken",
    "created",
    "rating",
    "size"
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
const MAX_SEARCH_LENGTH = 160;
const MAX_PHOTO_DECISIONS = 20000;
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

function normalizedDecision(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const photoKey = typeof item.photoKey === "string" &&
        /^p1-[0-9a-f]{16}$/.test(item.photoKey)
        ? item.photoKey
        : null;
    if (!photoKey) return null;
    const rating = normalizedRating(item.rating);
    const favorite = item.favorite === true;
    if (!rating && !favorite) return null;
    return Object.freeze({ photoKey, rating, favorite });
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
        favorite: photo?.favorite === true
    };
}

export function photoDecisionFor(value, photo) {
    const decision = effectivePhotoDecision(photo, photoDecisionMap(value));
    return Object.freeze({
        rating: decision.rating,
        favorite: decision.favorite
    });
}

export function createPhotoDecisionLookup(value = {}) {
    const decisionsByKey = photoDecisionMap(value);
    return photo => {
        const decision = effectivePhotoDecision(photo, decisionsByKey);
        return Object.freeze({
            rating: decision.rating,
            favorite: decision.favorite
        });
    };
}

export function updatePhotoDecision(value, photo, changes = {}) {
    const photoKey = photoDecisionKey(photo);
    const current = normalizePhotoDecisions(value);
    if (!photoKey) return current;
    const byKey = new Map(current.items.map(item => [item.photoKey, item]));
    const previous = byKey.get(photoKey) || { rating: 0, favorite: false };
    const rating = Object.prototype.hasOwnProperty.call(changes, "rating")
        ? normalizedRating(changes.rating)
        : previous.rating;
    const favorite = Object.prototype.hasOwnProperty.call(changes, "favorite")
        ? changes.favorite === true
        : previous.favorite;
    if (!rating && !favorite) byKey.delete(photoKey);
    else byKey.set(photoKey, { photoKey, rating, favorite });
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
        favoritesOnly: source.favoritesOnly === true,
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

function matchesPhoto(photo, preferences, range, decisionsByKey) {
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
    if (decision.rating < preferences.minimumRating) return false;
    if (preferences.favoritesOnly && !decision.favorite) return false;
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
    { now, decisions = {} } = {}
) {
    const source = Array.isArray(photos) ? photos : [];
    const preferences = normalizePhotoBrowserPreferences(value);
    const decisionsByKey = photoDecisionMap(decisions);
    const range = dateRange(preferences.datePreset, now);
    const matched = source
        .filter(photo => matchesPhoto(
            photo,
            preferences,
            range,
            decisionsByKey
        ))
        .slice()
        .sort((left, right) => comparePhotos(
            left,
            right,
            preferences.sort,
            decisionsByKey
        ));
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
        preferences.favoritesOnly ||
        preferences.datePreset !== "any"
    );
}
