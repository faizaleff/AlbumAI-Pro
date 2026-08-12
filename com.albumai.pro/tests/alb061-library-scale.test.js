import assert from "assert";

import { ThumbnailCache } from "../src/cache/ThumbnailCache";
import { calculatePhotoBrowserWindow } from
    "../src/components/ThumbnailGrid";
import {
    analyzeExactPhotoDuplicates,
    PhotoDuplicateStatus
} from "../src/services/PhotoDuplicateModel";
import { queryPhotoBrowser } from "../src/services/PhotoBrowserModel";
import PhotoBrowserPerformance from
    "../src/services/PhotoBrowserPerformance";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-061 Slice 4: ${name}`);
}

function duplicateContent(group) {
    const bytes = new Uint8Array(64);
    for (let index = 0; index < bytes.length; index++) {
        bytes[index] = (group * 31 + index) % 251;
    }
    return bytes;
}

async function run() {
    await test("prunes a 10,000-photo library before sequential fingerprinting", async () => {
        const photos = Array.from({ length: 10000 }, (_, index) => {
            const duplicate = index < 200;
            return {
                id: `/scale/photo-${String(index).padStart(5, "0")}.jpg`,
                name: `photo-${String(index).padStart(5, "0")}.jpg`,
                extension: "jpg",
                fileSize: duplicate ? 64 : 1000 + index,
                modified: 100,
                duplicateContent: duplicate
                    ? duplicateContent(Math.floor(index / 2))
                    : null
            };
        });
        let activeReads = 0;
        let peakReads = 0;
        let reads = 0;
        const startedAt = Date.now();
        const evidence = await analyzeExactPhotoDuplicates(photos, {
            readBinary: async photo => {
                reads += 1;
                activeReads += 1;
                peakReads = Math.max(peakReads, activeReads);
                await Promise.resolve();
                activeReads -= 1;
                return photo.duplicateContent;
            }
        });
        const durationMs = Date.now() - startedAt;
        assert.strictEqual(evidence.status, PhotoDuplicateStatus.COMPLETE);
        assert.strictEqual(evidence.candidatePhotos, 200);
        assert.strictEqual(evidence.fingerprintedPhotos, 200);
        assert.strictEqual(reads, 200);
        assert.strictEqual(peakReads, 1);
        assert.strictEqual(evidence.groups.length, 100);
        assert.strictEqual(evidence.duplicatePhotos, 200);
        assert.strictEqual(evidence.potentialSavingsBytes, 6400);
        assert(durationMs < 5000, `Duplicate scale projection took ${durationMs}ms.`);

        const first = queryPhotoBrowser(photos, {
            duplicatesOnly: true,
            sort: { field: "name", direction: "asc" }
        }, { duplicateEvidence: evidence });
        const second = queryPhotoBrowser(photos, {
            duplicatesOnly: true,
            sort: { field: "name", direction: "asc" }
        }, { duplicateEvidence: evidence });
        assert.strictEqual(first.counts.total, 10000);
        assert.strictEqual(first.counts.matched, 200);
        assert.deepStrictEqual(
            first.photos.map(photo => photo.id),
            second.photos.map(photo => photo.id)
        );
    });

    await test("holds the thumbnail cache at its explicit entry ceiling", () => {
        const cache = new ThumbnailCache(250);
        const originalTrace = PhotoBrowserPerformance.trace;
        PhotoBrowserPerformance.trace = () => {};
        try {
            for (let index = 0; index < 1000; index++) {
                cache.set(`photo-${index}`, `source-${index}`);
            }
        } finally {
            PhotoBrowserPerformance.trace = originalTrace;
        }
        assert.deepStrictEqual(cache.snapshot(), {
            maxItems: 250,
            entries: 250,
            blobSources: 0,
            cacheOwners: 0,
            consumers: 0
        });
        assert.strictEqual(cache.has("photo-749"), false);
        assert.strictEqual(cache.has("photo-750"), true);
        assert.strictEqual(cache.has("photo-999"), true);
    });

    await test("keeps large icon and list projections inside locked windows", () => {
        const list = calculatePhotoBrowserWindow({
            photoCount: 10000,
            viewMode: "list",
            reducedProfiles: true,
            viewportWidth: 700,
            viewportHeight: 380,
            scrollTop: 190000
        });
        const icons = calculatePhotoBrowserWindow({
            photoCount: 10000,
            viewMode: "icons",
            reducedProfiles: true,
            viewportWidth: 700,
            viewportHeight: 520,
            scrollTop: 130000
        });
        assert(list.end - list.start <= 15);
        assert(icons.end - icons.start <= 42);
        assert(list.end < 10000);
        assert(icons.end < 10000);
        assert.strictEqual(
            PhotoBrowserPerformance.browserDocumentOpenViolations,
            0
        );
    });

    console.info(
        `ALB-061 library scale tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
