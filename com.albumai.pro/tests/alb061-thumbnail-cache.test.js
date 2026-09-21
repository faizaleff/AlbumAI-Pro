import assert from "assert";

import ThumbnailCacheSingleton, {
    ThumbnailCache
} from "../src/cache/ThumbnailCache";
import PhotoBrowserPerformance from
    "../src/services/PhotoBrowserPerformance";
import BrowserDecodeScheduler from "../src/services/BrowserDecodeScheduler";
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
    await test("popup pauses expensive refinements, permits drafts and resumes on close", async () => {
        await BrowserDecodeScheduler.whenIdle();
        const order = [];
        const resume = BrowserDecodeScheduler.holdRefinements();
        const request = (key, priority) => BrowserDecodeScheduler.request(key, release => {
            order.push(key); release();
        }, { priority });
        request("held-background", 2);
        request("popup-draft", 1);
        request("popup-zoom", 0);
        assert.deepStrictEqual(order, ["popup-draft", "popup-zoom"]);
        resume(); resume();
        await BrowserDecodeScheduler.whenIdle();
        assert.deepStrictEqual(order, ["popup-draft", "popup-zoom", "held-background"]);
        assert.equal(BrowserDecodeScheduler.backgroundHolds, 0);
    });
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

    await test("limits decoded image bytes, not only item count", () => {
        const cache = new ThumbnailCache(250, 100);
        cache.set("one", "one", 60);
        cache.set("two", "two", 60);
        assert.deepStrictEqual(cache.keys(), ["two"]);
        cache.set("current-original", "large", 180);
        assert.deepStrictEqual(cache.keys(), ["current-original"]);
        cache.remove("current-original");
        assert.equal(cache.size(), 0);
    });

    await test("sidebar and fit preview share a source and only the last viewer cancels", () => {
        const service = new ThumbnailService();
        const photo = { id: "shared-viewers", name: "sample.jpg" };
        assert.equal(getThumbnailCacheKey(photo, "preview"), getThumbnailCacheKey(photo, "review-1536"));
        const first = service.retainRequest(photo, "preview");
        const second = service.retainRequest(photo, "review-1536");
        const key = getThumbnailCacheKey(photo, "preview");
        first(); assert.equal(service.requestUsers.get(key), 1);
        second(); assert(!service.requestUsers.has(key));
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

    await test("retains bounded small previews across close and releases originals", async () => {
        await withPerformanceSpies(({ released }) => {
            ThumbnailCacheSingleton.clear("review-budget-test");
            const service = new ThumbnailService();
            const publish = (key, bytes) => {
                ThumbnailCacheSingleton.set(key, `blob:${key}`);
                service.setCacheAlias(`alias-${key}`, key);
                service.limitReviewCache(key, bytes);
            };
            ThumbnailCacheSingleton.set("thumb", "blob:thumb");
            publish("one", 8 * 1024 * 1024);
            publish("two", 8 * 1024 * 1024);
            publish("three", 8 * 1024 * 1024);
            assert(ThumbnailCacheSingleton.has("one"));
            assert.strictEqual(service.reviewCacheSizes.size, 3);
            service.clearReviewPreviews({ keepSmall: true });
            assert(ThumbnailCacheSingleton.has("one"));
            publish("four", 8 * 1024 * 1024);
            publish("five", 8 * 1024 * 1024);
            assert(!ThumbnailCacheSingleton.has("one"));
            assert.strictEqual(service.reviewCacheSizes.size, 4);
            publish("original", 160 * 1024 * 1024);
            assert.deepStrictEqual([...service.reviewCacheSizes.keys()], ["original"]);
            ThumbnailCacheSingleton.retainSource("blob:original");
            service.clearReviewPreviews({ keepSmall: true });
            assert.strictEqual(service.reviewCacheSizes.size, 0);
            assert(ThumbnailCacheSingleton.has("thumb"));
            assert(!released.includes("blob:original"));
            ThumbnailCacheSingleton.releaseSource("blob:original");
            assert(released.includes("blob:original"));
            for (let i = 0; i < 12; i++) publish("small-" + i, 1024);
            assert.strictEqual(service.reviewCacheSizes.size, 8);
            service.clearReviewPreviews();
            assert.strictEqual(service.reviewCacheSizes.size, 0);
            ThumbnailCacheSingleton.clear("review-budget-cleanup");
        });
    });

    await test("cancels departed-photo preview jobs without cancelling shared thumbnails", async () => {
        const service = new ThumbnailService();
        service.activateWorkspace(0);
        let releaseBlocker;
        BrowserDecodeScheduler.request("review-test-blocker", release => { releaseBlocker = release; });
        const first = { id: "departed-review", name: "first.jpg" };
        const second = { id: "current-review", name: "second.jpg" };
        const requests = [service.getSource(first, { profile: "review-1280" }),
            service.getSource(second, { profile: "review-1280" }), service.getSource(first)];
        service.cancelReviewRequests(second);
        assert(!BrowserDecodeScheduler.jobs.has(getThumbnailCacheKey(first, "review-1280")));
        assert(BrowserDecodeScheduler.jobs.has(getThumbnailCacheKey(second, "review-1280")));
        assert(BrowserDecodeScheduler.jobs.has(getThumbnailCacheKey(first)));
        const cleared = service.clear();
        releaseBlocker();
        await cleared;
        assert.deepStrictEqual(await Promise.all(requests), [null, null, null]);
    });

    await test("photo invalidation removes drafts, thumbnails and every preview tier", async () => {
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
            const draftAlias = getThumbnailCacheKey(photo, "draft");
            const zoomAlias = getThumbnailCacheKey(photo, "review-6144");
            assert.notEqual(draftAlias, thumbnailAlias);
            service.failures.add(draftAlias);
            service.loadStates.set(draftAlias, "error");
            ThumbnailCacheSingleton.set("zoom-content", "blob:zoom");
            service.setCacheAlias(zoomAlias, "zoom-content");
            service.invalidatePhoto(photo);
            assert.strictEqual(service.failures.size, 0);
            assert.strictEqual(service.loadStates.size, 0);
            assert.strictEqual(service.cacheAliases.size, 0);
            assert.strictEqual(service.cacheAliasCounts.size, 0);
            assert.strictEqual(ThumbnailCacheSingleton.size(), 0);
            assert.deepStrictEqual(
                released.sort(),
                ["blob:preview", "blob:thumbnail", "blob:zoom"]
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

    await test("production runtime summary hook exposes only safe counts", () => {
        const service = new ThumbnailService();
        assert.strictEqual(
            typeof globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__,
            "function"
        );
        const summary = globalThis.__ALBUMAI_ALB042_RUNTIME_SUMMARY__();
        assert.strictEqual(summary.thumbnailCacheEntries >= 0, true);
        assert.strictEqual(summary.pendingJobs >= 0, true);
        assert.strictEqual(
            summary.photoshopDocumentsOpenedByBrowser >= 0,
            true
        );
        assert.strictEqual(JSON.stringify(summary).includes("nativePath"), false);
        assert.strictEqual(JSON.stringify(summary).includes("blob:"), false);
        assert.deepStrictEqual(service.emitRuntimeSummary("test"), summary);
    });

    console.info(
        `ALB-061 thumbnail cache tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
