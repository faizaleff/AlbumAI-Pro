import assert from "assert";
import jpeg from "jpeg-js";
import { rgbaPng, previewPixelBlob } from "../src/utils/PreviewPixels";
import ImageSourceCapabilityService from "../src/services/ImageSourceCapabilityService";
import { detectCameras, getCameraKey } from "../src/services/PhotoGroupingEngine";

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
    await test("reads camera and exposure EXIF without decoding image pixels", async () => {
        const tiff = new Uint8Array(260);
        tiff.set([0x49, 0x49, 42, 0, 8, 0, 0, 0]);
        const entry = (offset, tag, type, count, value) => {
            write16(tiff, offset, tag); write16(tiff, offset + 2, type);
            write32(tiff, offset + 4, count); write32(tiff, offset + 8, value);
        };
        write16(tiff, 8, 3);
        entry(10, 0x010f, 2, 6, 180);
        entry(22, 0x0110, 2, 7, 190);
        entry(34, 0x8769, 4, 1, 50);
        write16(tiff, 50, 6);
        entry(52, 0x829a, 5, 1, 210);
        entry(64, 0x829d, 5, 1, 218);
        entry(76, 0x8827, 3, 1, 800);
        entry(88, 0x920a, 5, 1, 226);
        entry(100, 0xa434, 2, 7, 200);
        entry(112, 0xa431, 2, 6, 240);
        tiff.set([65, 66, 49, 50, 51, 0], 240);
        for (const [offset, text] of [[180, "Canon"], [190, "EOS R5"], [200, "50mm F"]]) {
            [...text].forEach((char, index) => { tiff[offset + index] = char.charCodeAt(0); });
        }
        write32(tiff, 210, 1); write32(tiff, 214, 250);
        write32(tiff, 218, 28); write32(tiff, 222, 10);
        write32(tiff, 226, 50); write32(tiff, 230, 1);
        const original = jpegFixture();
        const binary = new Uint8Array(original.length + tiff.length + 10);
        binary.set([0xff, 0xd8, 0xff, 0xe1, 1, 12, 0x45, 0x78, 0x69, 0x66, 0, 0]);
        binary.set(tiff, 12);
        binary.set(original.slice(2), 12 + tiff.length);
        const facts = SoftwareJpegRenderer.inspectMetadata(binary);
        assert.strictEqual(facts.cameraMake, "Canon");
        assert.strictEqual(facts.cameraModel, "EOS R5");
        assert.strictEqual(facts.cameraSerial, "AB123");
        assert.strictEqual(facts.lensModel, "50mm F");
        assert.strictEqual(facts.exposureTime, 1 / 250);
        assert.strictEqual(facts.fNumber, 2.8);
        assert.strictEqual(facts.iso, 800);
        assert.strictEqual(facts.focalLength, 50);
        write32(binary, 12 + 60, 999999);
        assert.strictEqual(SoftwareJpegRenderer.inspectMetadata(binary).exposureTime, undefined);
    });

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

    await test("decodes JPEG and publishes lossless pixels without re-encoding JPEG", async () => {
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
        const rendered = await SoftwareJpegRenderer.render(encoded.data, {
            maxEdge: 1,
            quality: 0.8
        });
        assert.strictEqual(rendered.width, 1);
        assert.strictEqual(rendered.height, 1);
        assert.strictEqual(rendered.format, "image/png");
        URL.revokeObjectURL(rendered.source);
    });

    await test("writes valid lossless PNG fallback and prefers native ImageBlob", async () => {
        const pixels = new Uint8Array([255, 32, 64, 255, 0, 128, 255, 255]);
        const png = new Uint8Array(await (await rgbaPng(pixels, 2, 1)).arrayBuffer());
        assert.deepStrictEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        const view = new DataView(png.buffer);
        const compressed = [];
        for (let offset = 8; offset < png.length;) {
            const length = view.getUint32(offset);
            const name = String.fromCharCode(...png.slice(offset + 4, offset + 8));
            if (name === "IDAT") compressed.push(png.slice(offset + 8, offset + 8 + length));
            offset += length + 12;
        }
        const raw = require("zlib").inflateSync(Buffer.concat(compressed));
        assert.deepStrictEqual([...raw], [0, ...pixels]);
        let options;
        globalThis.ImageBlob = class { constructor(buffer, config) { assert.strictEqual(buffer, pixels); options = config; } };
        try {
            const native = await previewPixelBlob(pixels, 2, 1);
            assert(native instanceof ImageBlob);
            assert.equal(options.type, "image/uncompressed");
            assert.equal(options.components, 4);
            assert.equal(options.width, 2);
            const subset = new Uint8Array(16).subarray(4, 12);
            globalThis.ImageBlob = class { constructor(buffer) { assert.strictEqual(buffer, subset); } };
            assert(await previewPixelBlob(subset, 2, 1) instanceof ImageBlob);
            globalThis.ImageBlob = class { constructor() { throw new TypeError("Unsupported host"); } };
            assert.equal((await previewPixelBlob(pixels, 2, 1)).type, "image/png");
        } finally { delete globalThis.ImageBlob; }
    });

    await test("renders embedded drafts without ever decoding the original", async () => {
        // The main image has metadata only: attempting its entropy decode fails.
        const original = jpegFixture();
        await assert.rejects(SoftwareJpegRenderer.render(original, { maxEdge: 160, embeddedOnly: true }),
            { name: "EmbeddedJpegUnavailableError" });
        const thumb = jpeg.encode({ width: 16, height: 8, data: new Uint8Array(16 * 8 * 4).fill(255) }, 80).data;
        const tiff = new Uint8Array(56 + thumb.length);
        tiff.set([0x49, 0x49, 42, 0, 8, 0, 0, 0]);
        write16(tiff, 8, 1);
        write16(tiff, 10, 0x0112); write16(tiff, 12, 3); write32(tiff, 14, 1); write16(tiff, 18, 6);
        write32(tiff, 22, 26); write16(tiff, 26, 2);
        write16(tiff, 28, 0x0201); write16(tiff, 30, 4); write32(tiff, 32, 1); write32(tiff, 36, 56);
        write16(tiff, 40, 0x0202); write16(tiff, 42, 4); write32(tiff, 44, 1); write32(tiff, 48, thumb.length);
        tiff.set(thumb, 56);
        const binary = new Uint8Array(12 + tiff.length + original.length - 2);
        const length = tiff.length + 8;
        binary.set([255, 216, 255, 225, length >> 8, length & 255, 69, 120, 105, 102, 0, 0]);
        binary.set(tiff, 12); binary.set(original.subarray(2), 12 + tiff.length);
        const rendered = await SoftwareJpegRenderer.render(binary, { maxEdge: 160, embeddedOnly: true });
        assert.deepStrictEqual([rendered.width, rendered.height], [8, 16], "orient draft without upscaling it");
        assert.equal(rendered.strategy, "embedded-exif-jpeg");
        URL.revokeObjectURL(rendered.source);
        await assert.rejects(SoftwareJpegRenderer.render(binary, { maxEdge: 160, embeddedOnly: true,
            lifecycle: { throwIfCancelled() { const error = new Error("stale"); error.name = "StaleImageRequestError"; throw error; } } }),
            { name: "StaleImageRequestError" });
    });

    await test("reuses only the recent foreground file and invalidates it on revision/clear", async () => {
        const service = ImageSourceCapabilityService;
        service.clear();
        let reads = 0;
        const photo = { id: "binary-cache", fileSize: 8, modified: 1,
            file: { isFile: true, name: "binary-cache.jpg", nativePath: "/test/binary-cache.jpg", read: async () => { reads++; return new ArrayBuffer(8); } } };
        const first = await service.readBinary(photo, true);
        assert.strictEqual(await service.readBinary(photo), first);
        assert.equal(reads, 1);
        photo.modified = 2;
        await service.readBinary(photo, true);
        assert.equal(reads, 2);
        service.clear();
        await service.readBinary(photo);
        await service.readBinary(photo);
        assert.equal(reads, 4, "background reads must not populate the retained full-file cache");
        service.clear();
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
                cameraMake: "Canon", cameraModel: value === 3 ? "R6" : "R5",
                cameraSerial: String(value)
            })
        });
        const photos = [1, 2, 3].map(id => ({
            id,
            name: `${id}.jpg`,
            extension: "jpg",
            width: 0,
            height: 0,
            metadataLoaded: true
        }));
        state.service.lifecycleGeneration = 4;
        await state.service.extractMetadata(photos, 4);
        assert.strictEqual(peakReads, 1);
        assert.deepStrictEqual(
            photos.map(photo => [photo.width, photo.height]),
            [[100, 50], [200, 100], [300, 150]]
        );
        assert.ok(photos.every(photo => photo.metadataLoaded));
        assert.ok(photos.every(photo => photo.cameraMetadataLoaded));
        assert.strictEqual(detectCameras(photos).length, 3);
        assert.notStrictEqual(getCameraKey(photos[0]), getCameraKey(photos[1]));
        assert.strictEqual(detectCameras([{cameraMake:"Canon",cameraModel:"R5"},
            {cameraMake:" Canon ",cameraModel:"r5"}]).length, 1);
        let cached;
        state.service.projectEngine.getProject = () => ({workspace:{cache:{metadata:{
            createFile: async () => ({write: async text => { cached = JSON.parse(text); }})
        }}}});
        await state.service.writeMetadataCache(photos);
        assert.deepStrictEqual(cached.photos.map(p => p.cameraSerial), ["1", "2", "3"]);
        assert.strictEqual(cached.photos[2].cameraModel, "R6");
        assert.strictEqual(state.refreshes(), 3);
        assert.strictEqual(state.service.metadataStatus.phase, "ready");
        assert.strictEqual(state.service.metadataStatus.completed, 3);
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
        await Promise.resolve();
        state.service.lifecycleGeneration = 8;
        releaseRead(jpegFixture());
        await pending;
        assert.strictEqual(inspections, 0);
        assert.strictEqual(photo.width, 0);
        assert.strictEqual(photo.metadataLoaded, false);
        assert.strictEqual(state.refreshes(), 1, "only the initial loading status may publish");
    });

    await test("reuses complete revision-matched metadata and reinspects changed files", async () => {
        let reads = 0, cached;
        const state = serviceFixture({
            readBinary: async () => { reads++; return jpegFixture(); },
            inspectMetadata: () => ({width: 100, height: 50, cameraMake: "Sony", cameraModel: "Test", lensModel: "Lens", iso: 200})
        });
        state.service.projectEngine.getProject = () => ({workspace:{cache:{metadata:{
            getEntry: async () => ({read: async () => cached}),
            createFile: async () => ({write: async text => { cached = text; }})
        }}}});
        const photo = modified => ({id: "same-file", extension: "jpg", fileSize: 100, modified});
        await state.service.extractMetadata([photo(1)], 0);
        assert.strictEqual(reads, 1);
        const warm = photo(1);
        await state.service.extractMetadata([warm], 0);
        assert.strictEqual(reads, 1, "reopening must avoid reading unchanged source JPEGs");
        assert.strictEqual(warm.cameraModel, "Test");
        assert.strictEqual(warm.iso, 200);
        assert.strictEqual(warm.lensModel, "Lens");
        await state.service.extractMetadata([photo(2)], 0);
        assert.strictEqual(reads, 2, "modified source invalidates cached facts");
        cached = JSON.stringify({photos: JSON.parse(cached).photos});
        await state.service.extractMetadata([photo(2)], 0);
        assert.strictEqual(reads, 3, "legacy caches need a complete inspection");
    });

    await test("reports settled failures and releases refinement priority after metadata", async () => {
        const state = serviceFixture({readBinary: async () => { throw new Error("unreadable"); }, inspectMetadata: () => null});
        let resumed = 0, held = 0;
        state.service.metadataScheduler.holdRefinements = () => {held++; return () => resumed++;};
        const request = state.service.metadataScheduler.request;
        state.service.metadataScheduler.request = (key, start, options) => {
            assert.strictEqual(options.priority, 1, "metadata must run ahead of full thumbnail refinement");
            return request(key, start, options);
        };
        const photo = {id: "broken", extension:"jpg"};
        await state.service.extractMetadata([photo], 0);
        assert.strictEqual(state.service.metadataStatus.phase, "ready");
        assert.strictEqual(state.service.metadataStatus.completed, 1);
        assert.strictEqual(state.service.metadataStatus.failed, 1);
        assert.strictEqual(photo.metadataLoaded, undefined);
        assert.strictEqual(photo.metadataReadFailed, true);
        assert.strictEqual(held, 1); assert.strictEqual(resumed, 1);
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
