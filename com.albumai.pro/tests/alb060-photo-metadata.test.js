import assert from "assert";

import PhotoWorkspaceService from "../src/services/PhotoWorkspaceService";
import { inspectJpegMetadata } from "../src/services/SoftwareJpegRenderer";
import { calculatePhotoBrowserWindow } from
    "../src/components/ThumbnailGrid";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-060 Slice 3: ${name}`);
}

function write16(bytes, offset, value) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = value >>> 8;
}

function write32(bytes, offset, value) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = value >>> 8;
    bytes[offset + 2] = value >>> 16;
    bytes[offset + 3] = value >>> 24;
}

function jpegFixture({ width = 4000, height = 3000, orientation = 6 } = {}) {
    const date = "2026:08:12 00:15:30\0";
    const tiff = new Uint8Array(56 + date.length);
    tiff[0] = 0x49;
    tiff[1] = 0x49;
    write16(tiff, 2, 42);
    write32(tiff, 4, 8);
    write16(tiff, 8, 2);
    write16(tiff, 10, 0x0112);
    write16(tiff, 12, 3);
    write32(tiff, 14, 1);
    write16(tiff, 18, orientation);
    write16(tiff, 22, 0x8769);
    write16(tiff, 24, 4);
    write32(tiff, 26, 1);
    write32(tiff, 30, 38);
    write32(tiff, 34, 0);
    write16(tiff, 38, 1);
    write16(tiff, 40, 0x9003);
    write16(tiff, 42, 2);
    write32(tiff, 44, date.length);
    write32(tiff, 48, 56);
    write32(tiff, 52, 0);
    for (let index = 0; index < date.length; index++) {
        tiff[56 + index] = date.charCodeAt(index);
    }

    const exif = new Uint8Array(6 + tiff.length);
    exif.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
    exif.set(tiff, 6);
    const appLength = exif.length + 2;
    const output = new Uint8Array(2 + 4 + exif.length + 19 + 2);
    let offset = 0;
    output.set([0xff, 0xd8, 0xff, 0xe1], offset);
    offset += 4;
    output[offset++] = appLength >>> 8;
    output[offset++] = appLength & 0xff;
    output.set(exif, offset);
    offset += exif.length;
    output.set([
        0xff, 0xc0, 0, 17, 8,
        height >>> 8, height & 0xff,
        width >>> 8, width & 0xff,
        3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0
    ], offset);
    offset += 19;
    output.set([0xff, 0xd9], offset);
    return output;
}

function serviceFixture({ readBinary, inspectMetadata } = {}) {
    let refreshes = 0;
    const traces = [];
    const service = new PhotoWorkspaceService({
        library: { getPhotos: () => [], load: () => {} },
        selection: {},
        projectEngine: {
            isOpen: () => true,
            getProject: () => ({ metadata: { id: "project-one" } })
        },
        projectService: {},
        localFileSystem: {},
        thumbnailService: {},
        thumbnailQueue: {},
        refreshService: { refresh: () => { refreshes++; } },
        performance: {
            trace: (event, values) => traces.push({ event, values })
        },
        metadataScheduler: {
            request: (_key, start) => {
                start(() => {});
                return true;
            }
        },
        metadataSource: { readBinary },
        metadataInspector: {
            supports: () => true,
            inspectMetadata
        }
    });
    return {
        service,
        traces,
        refreshes: () => refreshes
    };
}

async function run() {
    await test("extracts oriented dimensions and normalized Date Taken", async () => {
        const metadata = inspectJpegMetadata(jpegFixture());
        assert.strictEqual(metadata.width, 3000);
        assert.strictEqual(metadata.height, 4000);
        assert.strictEqual(metadata.orientation, 6);
        assert.strictEqual(metadata.dateTaken, "2026-08-12T00:15:30");
        assert.ok(Object.isFrozen(metadata));
    });

    await test("fails closed for malformed or non-JPEG input", async () => {
        assert.deepStrictEqual(
            inspectJpegMetadata(new Uint8Array([1, 2, 3, 4])),
            {
                embedded: null,
                width: 0,
                height: 0,
                orientation: 1,
                dateTaken: null
            }
        );
    });

    await test("enriches photos sequentially and persists normalized facts", async () => {
        let activeReads = 0;
        let peakReads = 0;
        const state = serviceFixture({
            readBinary: async photo => {
                activeReads++;
                peakReads = Math.max(peakReads, activeReads);
                await Promise.resolve();
                activeReads--;
                return photo.id;
            },
            inspectMetadata: value => ({
                width: value * 100,
                height: value * 50,
                orientation: 1,
                dateTaken: "2026-08-12T00:15:30"
            })
        });
        const photos = [1, 2, 3].map(id => ({
            id,
            name: `${id}.jpg`,
            extension: "jpg",
            width: 0,
            height: 0,
            metadataLoaded: false
        }));
        state.service.lifecycleGeneration = 4;
        await state.service.extractMetadata(photos, 4);
        assert.strictEqual(peakReads, 1);
        assert.deepStrictEqual(
            photos.map(photo => [photo.width, photo.height]),
            [[100, 50], [200, 100], [300, 150]]
        );
        assert.ok(photos.every(photo => photo.metadataLoaded));
        assert.strictEqual(state.refreshes(), 1);
    });

    await test("rejects metadata from a stale folder generation", async () => {
        let releaseRead;
        let inspections = 0;
        const state = serviceFixture({
            readBinary: () => new Promise(resolve => { releaseRead = resolve; }),
            inspectMetadata: () => {
                inspections++;
                return { width: 100, height: 50, orientation: 1 };
            }
        });
        const photo = {
            id: 1,
            name: "one.jpg",
            extension: "jpg",
            width: 0,
            height: 0,
            metadataLoaded: false
        };
        state.service.lifecycleGeneration = 7;
        const pending = state.service.extractMetadata([photo], 7);
        state.service.lifecycleGeneration = 8;
        releaseRead(jpegFixture());
        await pending;
        assert.strictEqual(inspections, 0);
        assert.strictEqual(photo.width, 0);
        assert.strictEqual(photo.metadataLoaded, false);
        assert.strictEqual(state.refreshes(), 0);
    });

    await test("keeps large list and icon libraries inside bounded windows", async () => {
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
        assert.ok(list.end - list.start <= 15);
        assert.ok(list.visibleEnd - list.visibleStart <= 10);
        assert.ok(icons.end - icons.start <= 42);
        assert.ok(icons.visibleEnd - icons.visibleStart <= 30);
        assert.ok(list.end < 10000);
        assert.ok(icons.end < 10000);
    });

    console.info(
        `ALB-060 photo metadata tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
