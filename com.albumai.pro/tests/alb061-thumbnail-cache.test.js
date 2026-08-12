import assert from "assert";

import ThumbnailCacheSingleton, {
    ThumbnailCache
} from "../src/cache/ThumbnailCache";
import PhotoBrowserPerformance from
    "../src/services/PhotoBrowserPerformance";
import {
    getThumbnailCacheKey,
    ThumbnailService
} from "../src/services/ThumbnailService";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-061 Slice 1: ${name}`);
}

async function withPerformanceSpies(callback) {
    const released = [];
    const traces = [];
    const originalRelease = PhotoBrowserPerformance.releaseObjectUrl;
    const originalTrace = PhotoBrowserPerformance.trace;

    PhotoBrowserPerformance.releaseObjectUrl =
        source => released.push(source);
    PhotoBrowserPerformance.trace =
        (event, values) => traces.push({ event, values });

    try {
        await callback({ released, traces });
    } finally {
        PhotoBrowserPerformance.releaseObjectUrl = originalRelease;
        PhotoBrowserPerformance.trace = originalTrace;
    }
}

async function run() {
    await test("normalizes limits and preserves the runtime ceiling", () => {
        assert.strictEqual(ThumbnailCacheSingleton.snapshot().maxItems, 250);
        assert.strictEqual(new ThumbnailCache(2.9).maxItems, 2);
        assert.strictEqual(new ThumbnailCache(0).maxItems, 250);
        assert.strictEqual(new ThumbnailCache(Number.NaN).maxItems, 250);
    });

    await test("evicts the least recently used entry", async () => {
        await withPerformanceSpies(({ traces }) => {
            const cache = new ThumbnailCache(2);
            cache.set("one", "source-one");
            cache.set("two", "source-two");
            assert.strictEqual(cache.get("one"), "source-one");
            cache.set("three", "source-three");
            assert.deepStrictEqual(cache.keys(), ["one", "three"]);
            assert.strictEqual(cache.get("two"), null);
            assert.strictEqual(
                traces.filter(item => item.event === "THUMB_CACHE_EVICT").length,
                1
            );
        });
    });

    await test("same-value publication refreshes recency", () => {
        const cache = new ThumbnailCache(2);
        cache.set("one", "source-one");
        cache.set("two", "source-two");
        cache.set("one", "source-one");
        cache.set("three", "source-three");
        assert.deepStrictEqual(cache.keys(), ["one", "three"]);
    });

    await test("shared cache ownership releases only once unowned", async () => {
        await withPerformanceSpies(({ released }) => {
            const cache = new ThumbnailCache(4);
            cache.set("alias-one", "blob:shared");
            cache.set("alias-two", "blob:shared");
            cache.remove("alias-one");
            assert.deepStrictEqual(released, []);
            cache.set("alias-two", "blob:replacement");
            assert.deepStrictEqual(released, ["blob:shared"]);
            cache.clear("test-clear");
            assert.deepStrictEqual(
                released,
                ["blob:shared", "blob:replacement"]
            );
        });
    });

    await test("active consumers protect evicted blob sources", async () => {
        await withPerformanceSpies(({ released }) => {
            const cache = new ThumbnailCache(1);
            cache.set("one", "blob:one");
            cache.retainSource("blob:one");
            cache.set("two", "blob:two");
            assert.deepStrictEqual(released, []);
            assert.deepStrictEqual(cache.snapshot(), {
                maxItems: 1,
                entries: 1,
                blobSources: 2,
                cacheOwners: 1,
                consumers: 1
            });
            cache.releaseSource("blob:one");
            assert.deepStrictEqual(released, ["blob:one"]);
            cache.clear();
            assert.deepStrictEqual(released, ["blob:one", "blob:two"]);
        });
    });

    await test("replacement releases the prior owned source", async () => {
        await withPerformanceSpies(({ released }) => {
            const cache = new ThumbnailCache(2);
            cache.set("photo", "blob:old");
            cache.set("photo", "blob:new");
            assert.deepStrictEqual(released, ["blob:old"]);
            assert.strictEqual(cache.get("photo"), "blob:new");
        });
    });

    await test("safe statistics are detached and immutable", () => {
        const cache = new ThumbnailCache(3);
        cache.set("one", "blob:one");
        cache.retainSource("blob:one");
        const snapshot = cache.snapshot();
        assert.deepStrictEqual(snapshot, {
            maxItems: 3,
            entries: 1,
            blobSources: 1,
            cacheOwners: 1,
            consumers: 1
        });
        assert(Object.isFrozen(snapshot));
        assert(!Object.prototype.hasOwnProperty.call(snapshot, "keys"));
        assert(!JSON.stringify(snapshot).includes("blob:one"));
    });

    await test("stale aliases are removed when their target is absent", async () => {
        await withPerformanceSpies(() => {
            ThumbnailCacheSingleton.clear("alias-test-setup");
            const service = new ThumbnailService();
            const photo = {
                id: "photo-one", name: "one.jpg",
                fileSize: 10, modified: 100
            };
            const alias = getThumbnailCacheKey(photo, "thumbnail");
            const target = "content-one";
            ThumbnailCacheSingleton.set(target, "source-one");
            service.setCacheAlias(alias, target);
            assert.strictEqual(service.getCachedThumbnail(photo), "source-one");
            ThumbnailCacheSingleton.remove(target);
            assert.strictEqual(service.getCachedThumbnail(photo), null);
            assert.strictEqual(service.cacheAliases.has(alias), false);
            assert.strictEqual(service.cacheAliasCounts.has(target), false);
        });
    });

    await test("photo invalidation removes thumbnail and preview aliases", async () => {
        await withPerformanceSpies(({ released }) => {
            ThumbnailCacheSingleton.clear("invalidation-test-setup");
            const service = new ThumbnailService();
            const photo = {
                id: "photo-two", name: "two.jpg",
                fileSize: 20, modified: 200
            };
            const thumbnailAlias = getThumbnailCacheKey(photo, "thumbnail");
            const previewAlias = getThumbnailCacheKey(photo, "preview");
            ThumbnailCacheSingleton.set("thumbnail-content", "blob:thumbnail");
            ThumbnailCacheSingleton.set("preview-content", "blob:preview");
            service.setCacheAlias(thumbnailAlias, "thumbnail-content");
            service.setCacheAlias(previewAlias, "preview-content");
            service.invalidatePhoto(photo);
            assert.strictEqual(service.cacheAliases.size, 0);
            assert.strictEqual(service.cacheAliasCounts.size, 0);
            assert.strictEqual(ThumbnailCacheSingleton.size(), 0);
            assert.deepStrictEqual(
                released.sort(),
                ["blob:preview", "blob:thumbnail"]
            );
        });
    });

    await test("same-folder clear preserves cache and destructive clear releases it", async () => {
        await withPerformanceSpies(async ({ released }) => {
            ThumbnailCacheSingleton.clear("lifecycle-test-setup");
            const service = new ThumbnailService();
            const photo = {
                id: "photo-three", name: "three.jpg",
                fileSize: 30, modified: 300
            };
            const alias = getThumbnailCacheKey(photo, "thumbnail");
            ThumbnailCacheSingleton.set(
                "shared-content", "blob:shared-content"
            );
            service.setCacheAlias(alias, "shared-content");
            const preserved = await service.clear({
                preserveCache: true,
                reason: "same-folder-refresh",
                workspaceGeneration: 1
            });
            assert.strictEqual(preserved.thumbnailCacheEntries, 1);
            assert.strictEqual(
                service.getCachedThumbnail(photo),
                "blob:shared-content"
            );
            assert.deepStrictEqual(released, []);
            await service.clear({
                preserveCache: false,
                reason: "project-close",
                workspaceGeneration: 2
            });
            assert.strictEqual(ThumbnailCacheSingleton.size(), 0);
            assert.strictEqual(service.cacheAliases.size, 0);
            assert.deepStrictEqual(released, ["blob:shared-content"]);
        });
    });

    await test("workspace clear cancels owned pending request state", async () => {
        const service = new ThumbnailService();
        let cancelCalls = 0;
        const pending = Promise.resolve();
        pending.cancel = () => { cancelCalls += 1; };
        const lifecycle = { cancelled: false };
        service.inFlight.set("pending-photo", pending);
        service.requestContexts.set("pending-photo", lifecycle);
        await service.clear({
            preserveCache: true,
            workspaceGeneration: 1
        });
        assert.strictEqual(cancelCalls, 1);
        assert.strictEqual(lifecycle.cancelled, true);
        assert.strictEqual(service.inFlight.size, 0);
        assert.strictEqual(service.requestContexts.size, 0);
    });

    await test("workspace generations reject stale image requests", async () => {
        const service = new ThumbnailService();
        const photo = {
            id: "photo-four", name: "four.jpg",
            fileSize: 40, modified: 400
        };
        assert.strictEqual(service.activateWorkspace(0), true);
        assert.strictEqual(service.isWorkspaceGenerationCurrent(0), true);
        await service.clear({
            preserveCache: true,
            workspaceGeneration: 1
        });
        assert.strictEqual(service.activateWorkspace(0), false);
        assert.strictEqual(
            await service.getThumbnail(photo, { workspaceGeneration: 0 }),
            null
        );
        assert.strictEqual(service.activateWorkspace(1), true);
        assert.strictEqual(service.isWorkspaceGenerationCurrent(1), true);
    });

    console.info(
        `ALB-061 thumbnail cache tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
