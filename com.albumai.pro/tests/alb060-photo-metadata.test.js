import assert from "assert";
import jpeg from "jpeg-js";

import PhotoWorkspaceService from "../src/services/PhotoWorkspaceService";
import SoftwareJpegRenderer, {
    inspectJpegMetadata
} from "../src/services/SoftwareJpegRenderer";
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
    const cameraMake = "Canon\0";
    const cameraModel = "EOS R5\0";
    const dataOffset = 80;
    const makeOffset = dataOffset;
    const modelOffset = makeOffset + cameraMake.length;
    const dateOffset = modelOffset + cameraModel.length;
    const tiff = new Uint8Array(dateOffset + date.length);
    tiff[0] = 0x49;
    tiff[1] = 0x49;
    write16(tiff, 2, 42);
    write32(tiff, 4, 8);
    write16(tiff, 8, 4);
    write16(tiff, 10, 0x0112);
    write16(tiff, 12, 3);
    write32(tiff, 14, 1);
    write16(tiff, 18, orientation);
    write16(tiff, 22, 0x8769);
    write16(tiff, 24, 4);
    write32(tiff, 26, 1);
    write32(tiff, 30, 62);
    write16(tiff, 34, 0x010f);
    write16(tiff, 36, 2);
    write32(tiff, 38, cameraMake.length);
    write32(tiff, 42, makeOffset);
    write16(tiff, 46, 0x0110);
    write16(tiff, 48, 2);
    write32(tiff, 50, cameraModel.length);
    write32(tiff, 54, modelOffset);
    write32(tiff, 58, 0);
    write16(tiff, 62, 1);
    write16(tiff, 64, 0x9003);
    write16(tiff, 66, 2);
    write32(tiff, 68, date.length);
    write32(tiff, 72, dateOffset);
    write32(tiff, 76, 0);
    for (let index = 0; index < cameraMake.length; index++) {
        tiff[makeOffset + index] = cameraMake.charCodeAt(index);
    }
    for (let index = 0; index < cameraModel.length; index++) {
        tiff[modelOffset + index] = cameraModel.charCodeAt(index);
    }
    for (let index = 0; index < date.length; index++) {
        tiff[dateOffset + index] = date.charCodeAt(index);
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
        assert.strictEqual(metadata.cameraMake, "Canon");
        assert.strictEqual(metadata.cameraModel, "EOS R5");
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
                dateTaken: null,
                cameraMake: null,
                cameraModel: null
            }
        );
    });

    await test("encodes and decodes JPEG bytes through the production Buffer shim", () => {
        const encoded = jpeg.encode({
            data: new Uint8Array([
                255, 0, 0, 255,
                0, 255, 0, 255,
                0, 0, 255, 255,
                255, 255, 255, 255
            ]),
            width: 2,
            height: 2
        }, 80);
        assert(encoded.data instanceof Uint8Array);
        const rendered = SoftwareJpegRenderer.render(encoded.data, {
            maxEdge: 1,
            quality: 0.8
        });
        assert.strictEqual(rendered.width, 1);
        assert.strictEqual(rendered.height, 1);
        assert.strictEqual(rendered.format, "image/jpeg");
        URL.revokeObjectURL(rendered.source);
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
                dateTaken: "2026-08-12T00:15:30",
                cameraMake: value === 1 ? "Canon" : "Sony",
                cameraModel: value === 1 ? "EOS R5" : "A7 IV"
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
        assert.deepStrictEqual(
            photos.map(photo => [photo.cameraMake, photo.cameraModel]),
            [["Canon", "EOS R5"], ["Sony", "A7 IV"], ["Sony", "A7 IV"]]
        );
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
