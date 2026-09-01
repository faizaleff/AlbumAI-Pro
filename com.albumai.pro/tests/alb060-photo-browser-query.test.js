import assert from "assert";

import {
    applyPhotoStoryOrder,
    createPhotoDecisionLookup,
    hasActivePhotoBrowserFilters,
    movePhotosInStoryOrder,
    normalizePhotoDecisions,
    normalizePhotoBrowserPreferences,
    normalizePhotoStoryOrder,
    photoDecisionKey,
    photoOrientation,
    queryPhotoBrowser,
    reconcilePhotoDecisions,
    updatePhotoDecision
} from "../src/services/PhotoBrowserModel";
import {
    resolveCanonicalBrowserPhotos,
    setCanonicalBrowserPhotos
} from "../src/services/PhotoBrowserSelection";

let assertions = 0;

function test(name, callback) {
    callback();
    assertions += 1;
    console.info(`PASS ALB-060: ${name}`);
}

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-11T12:00:00.000Z").getTime();

function photo(id, values = {}) {
    return {
        id,
        name: `${id}.jpg`,
        extension: "jpg",
        width: 1200,
        height: 800,
        rating: 0,
        favorite: false,
        modified: new Date(now - day),
        created: new Date(now - day * 2),
        fileSize: 1000,
        ...values
    };
}

const photos = [
    photo("ten", {
        name: "Wedding 10.JPG",
        rating: 5,
        favorite: true,
        modified: new Date(now - day * 3),
        fileSize: 3000
    }),
    photo("two", {
        name: "Wedding 2.jpg",
        width: 800,
        height: 1200,
        rating: 3,
        modified: new Date(now - day * 10),
        fileSize: 2000
    }),
    photo("square", {
        name: "Reception.png",
        extension: "png",
        width: 900,
        height: 900,
        modified: null,
        fileSize: 500
    }),
    photo("unknown", {
        name: "No Dimensions.jpeg",
        extension: "jpeg",
        width: 0,
        height: 0,
        modified: null,
        fileSize: 0
    })
];

test("normalizes malformed and legacy preference values safely", () => {
    const normalized = normalizePhotoBrowserPreferences({
        search: " x".repeat(200),
        types: ["JPG", "jpg", null],
        orientations: ["portrait", "sideways"],
        minimumRating: 99,
        favoritesOnly: "yes",
        field: "modified",
        direction: "desc"
    });
    assert.strictEqual(normalized.schemaVersion, 1);
    assert.strictEqual(normalized.search.length, 160);
    assert.deepStrictEqual(normalized.types, ["jpg"]);
    assert.deepStrictEqual(normalized.orientations, ["portrait"]);
    assert.strictEqual(normalized.minimumRating, 5);
    assert.strictEqual(normalized.favoritesOnly, false);
    assert.strictEqual(normalized.duplicatesOnly, false);
    assert.deepStrictEqual(normalized.sort, {
        field: "modified",
        direction: "desc"
    });
});

test("search is bounded, case-insensitive, and filename-only", () => {
    const result = queryPhotoBrowser(photos, { search: "WEDDING 2" });
    assert.deepStrictEqual(result.photos.map(item => item.id), ["two"]);
    assert.deepStrictEqual(result.counts, { total: 4, matched: 1, hidden: 3 });
});

test("type and orientation filters compose", () => {
    const result = queryPhotoBrowser(photos, {
        types: ["jpg"],
        orientations: ["portrait"]
    });
    assert.deepStrictEqual(result.photos.map(item => item.id), ["two"]);
});

test("rating and favourite filters compose without mutating photos", () => {
    const before = JSON.stringify(photos);
    const result = queryPhotoBrowser(photos, {
        minimumRating: 4,
        favoritesOnly: true
    });
    assert.deepStrictEqual(result.photos.map(item => item.id), ["ten"]);
    assert.strictEqual(JSON.stringify(photos), before);
});

test("date presets use the selected metadata field", () => {
    const result = queryPhotoBrowser(photos, {
        datePreset: "last7",
        dateField: "modified"
    }, { now });
    assert.deepStrictEqual(result.photos.map(item => item.id), ["ten"]);
});

test("natural name sorting is deterministic", () => {
    const result = queryPhotoBrowser(photos.slice(0, 2), {
        sort: { field: "name", direction: "asc" }
    });
    assert.deepStrictEqual(result.photos.map(item => item.id), ["two", "ten"]);
});

test("numeric sorting keeps missing values last in both directions", () => {
    const ascending = queryPhotoBrowser(photos, {
        sort: { field: "modified", direction: "asc" }
    });
    const descending = queryPhotoBrowser(photos, {
        sort: { field: "modified", direction: "desc" }
    });
    assert.deepStrictEqual(ascending.photos.slice(-2).map(item => item.id), ["unknown", "square"]);
    assert.deepStrictEqual(descending.photos.slice(-2).map(item => item.id), ["unknown", "square"]);
});

test("orientation projection handles dimensions and published categories", () => {
    assert.strictEqual(photoOrientation(photos[0]), "landscape");
    assert.strictEqual(photoOrientation(photos[1]), "portrait");
    assert.strictEqual(photoOrientation(photos[2]), "square");
    assert.strictEqual(photoOrientation(photos[3]), "unknown");
    assert.strictEqual(photoOrientation({ orientation: "portrait" }), "portrait");
});

test("facets and result arrays are detached and immutable", () => {
    const result = queryPhotoBrowser(photos);
    assert.deepStrictEqual(result.facets.types, ["jpeg", "jpg", "png"]);
    assert.deepStrictEqual(result.facets.orientations, [
        "landscape",
        "portrait",
        "square",
        "unknown"
    ]);
    assert.notStrictEqual(result.photos, photos);
    assert(Object.isFrozen(result.photos));
    assert(Object.isFrozen(result.preferences));
});

test("active-filter detection ignores sort-only preferences", () => {
    assert.strictEqual(hasActivePhotoBrowserFilters({
        sort: { field: "modified", direction: "desc" }
    }), false);
    assert.strictEqual(hasActivePhotoBrowserFilters({ search: "bride" }), true);
});

test("an explicitly empty filtered result never falls back to the full library", () => {
    const fallback = [photo("fallback")];
    setCanonicalBrowserPhotos([]);
    assert.deepStrictEqual(resolveCanonicalBrowserPhotos(fallback), []);
});

test("photo decision keys are stable and do not persist source paths", () => {
    const source = photo("secure", {
        file: { nativePath: "/Users/example/private/Wedding 01.jpg" }
    });
    const key = photoDecisionKey(source);
    assert(/^p1-[0-9a-f]{16}$/.test(key));
    assert.strictEqual(key.includes("Users"), false);
    assert.strictEqual(photoDecisionKey({
        ...source,
        file: { nativePath: "/Users/example/private/Wedding 01.jpg" }
    }), key);
});

test("decision normalization is bounded, deterministic, and fail closed", () => {
    const firstKey = photoDecisionKey(photos[0]);
    const normalized = normalizePhotoDecisions({
        schemaVersion: 99,
        items: [
            { photoKey: "../../unsafe", rating: 5, favorite: true },
            { photoKey: firstKey, rating: 99, favorite: "yes" },
            { photoKey: firstKey, rating: 3, favorite: true }
        ]
    });
    assert.strictEqual(normalized.schemaVersion, 1);
    assert.deepStrictEqual(normalized.items, [{
        photoKey: firstKey,
        rating: 3,
        favorite: true
    }]);
    assert(Object.isFrozen(normalized.items));
});

test("rating and favourite updates are immutable and omit neutral decisions", () => {
    const empty = normalizePhotoDecisions();
    const rated = updatePhotoDecision(empty, photos[0], { rating: 4 });
    const favourite = updatePhotoDecision(rated, photos[0], {
        favorite: true
    });
    const cleared = updatePhotoDecision(favourite, photos[0], {
        rating: 0,
        favorite: false
    });
    assert.strictEqual(empty.items.length, 0);
    assert.deepStrictEqual(createPhotoDecisionLookup(favourite)(photos[0]), {
        rating: 4,
        favorite: true
    });
    assert.strictEqual(cleared.items.length, 0);
});

test("refresh reconciliation retains available decisions and removes stale keys", () => {
    let decisions = updatePhotoDecision({}, photos[0], { rating: 5 });
    decisions = updatePhotoDecision(decisions, photos[1], { favorite: true });
    const reconciled = reconcilePhotoDecisions(decisions, [photos[1]]);
    assert.strictEqual(reconciled.items.length, 1);
    assert.deepStrictEqual(createPhotoDecisionLookup(reconciled)(photos[1]), {
        rating: 0,
        favorite: true
    });
});

test("manual story order is deterministic, reconciled, and immutable", () => {
    const original = photos.slice(0, 3);
    const initial = normalizePhotoStoryOrder({}, original);
    const moved = movePhotosInStoryOrder(
        initial,
        original,
        original[2],
        original[0]
    );
    const ordered = applyPhotoStoryOrder(original, moved);
    assert.deepStrictEqual(
        ordered.map(item => item.id),
        ["square", "ten", "two"]
    );
    assert.deepStrictEqual(
        original.map(item => item.id),
        ["ten", "two", "square"]
    );
    assert(Object.isFrozen(moved));
    assert(Object.isFrozen(moved.items));
});

test("manual story order drops stale photos and appends newly imported photos", () => {
    const firstTwo = normalizePhotoStoryOrder({}, photos.slice(0, 2));
    const reconciled = normalizePhotoStoryOrder(firstTwo, photos.slice(1, 4));
    assert.deepStrictEqual(
        applyPhotoStoryOrder(photos.slice(1, 4), reconciled).map(item => item.id),
        ["two", "square", "unknown"]
    );
    assert.strictEqual(reconciled.items.length, 3);
});

test("manual story order moves a selected photo block without changing its internal order", () => {
    const original = photos.slice();
    const initial = normalizePhotoStoryOrder({}, original);
    const moved = movePhotosInStoryOrder(
        initial,
        original,
        original[0],
        original[3],
        [original[0], original[2]]
    );
    assert.deepStrictEqual(
        applyPhotoStoryOrder(original, moved).map(item => item.id),
        ["two", "ten", "square", "unknown"]
    );
    assert.deepStrictEqual(
        applyPhotoStoryOrder(original, initial).map(item => item.id),
        ["ten", "two", "square", "unknown"]
    );
});

test("dropping a selected block onto itself is an immutable no-op", () => {
    const original = photos.slice();
    const initial = normalizePhotoStoryOrder({}, original);
    const unchanged = movePhotosInStoryOrder(
        initial,
        original,
        original[0],
        original[2],
        [original[0], original[2]]
    );
    assert.deepStrictEqual(unchanged.items, initial.items);
    assert(Object.isFrozen(unchanged.items));
});

test("manual sort preserves source order until a story order is applied", () => {
    const source = [photos[2], photos[0], photos[1]];
    const result = queryPhotoBrowser(source, {
        sort: { field: "manual", direction: "desc" }
    });
    assert.strictEqual(result.preferences.sort.field, "manual");
    assert.strictEqual(result.preferences.sort.direction, "desc");
    assert.deepStrictEqual(result.photos.map(item => item.id), [
        "square",
        "ten",
        "two"
    ]);
});

    test("persisted decisions drive filters and sorting without photo mutation", () => {
    const before = JSON.stringify(photos);
    let decisions = updatePhotoDecision({}, photos[1], {
        rating: 5,
        favorite: true
    });

    test("large synthetic libraries remain deterministic and detached", () => {
        const large = Array.from({ length: 10000 }, (_, index) => ({
            id: `photo-${String(index).padStart(5, "0")}`,
            name: `Wedding-${String(index).padStart(5, "0")}.jpg`,
            extension: "jpg",
            width: index % 2 ? 1200 : 1800,
            height: index % 2 ? 1800 : 1200,
            modified: new Date(2026, 0, 1, 0, 0, index % 60)
        }));
        const preferences = {
            search: "wedding-00",
            orientations: ["landscape"],
            sort: { field: "modified", direction: "desc" }
        };
        const first = queryPhotoBrowser(large, preferences);
        const second = queryPhotoBrowser(large, preferences);
        assert.strictEqual(first.counts.total, 10000);
        assert.strictEqual(first.counts.matched, 500);
        assert.deepStrictEqual(
            first.photos.map(photo => photo.id),
            second.photos.map(photo => photo.id)
        );
        assert.notStrictEqual(first.photos, large);
        assert.strictEqual(large[0].width, 1800);
        assert.strictEqual(large[9999].name, "Wedding-09999.jpg");
    });
    decisions = updatePhotoDecision(decisions, photos[0], { rating: 2 });
    const filtered = queryPhotoBrowser(photos, {
        minimumRating: 4,
        favoritesOnly: true
    }, { decisions });
    const sorted = queryPhotoBrowser(photos.slice(0, 2), {
        sort: { field: "rating", direction: "desc" }
    }, { decisions });
    assert.deepStrictEqual(filtered.photos.map(item => item.id), ["two"]);
    assert.deepStrictEqual(sorted.photos.map(item => item.id), ["two", "ten"]);
    assert.strictEqual(JSON.stringify(photos), before);
});

console.info(`ALB-060 photo browser query tests complete: ${assertions} assertions.`);
