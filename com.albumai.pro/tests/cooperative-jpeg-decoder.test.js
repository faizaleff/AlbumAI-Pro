const assert = require("assert");
const jpeg = require("jpeg-js");
const decode = require("../src/utils/CooperativeJpegDecoder");

async function main() {
    const fixtures = require("./fixtures/cooperative-jpeg.json");
    for (const [mode, fixture] of Object.entries(fixtures)) {
        const bytes = Buffer.from(fixture, "base64");
        for (const rgba of [true, false]) {
            const options = { useTArray: true, formatAsRGBA: rgba };
            const reference = jpeg.decode(bytes, options);
            const actual = await decode(bytes, options);
            assert.deepStrictEqual(actual.data, reference.data, mode + " progressive parity");
            const small = await decode(bytes, Object.assign({}, options, { maxEdge: 10 }));
            assert.equal(small.width, 10);
            assert.equal(small.height, 8);
        }
    }
    const width = 1600, height = 1200;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = (i / 4) % 251;
        data[i + 1] = Math.floor(i / 4 / width) % 253;
        data[i + 2] = (i / 12) % 249;
        data[i + 3] = 255;
    }
    const bytes = jpeg.encode({ width, height, data }, 75).data;
    const options = { useTArray: true, formatAsRGBA: false };
    const expected = jpeg.decode(bytes, options);
    const full = await decode(bytes, options);
    assert.deepStrictEqual(full.data, expected.data);
    assert.equal(full.width, width);
    let heartbeats = 0;
    const timer = setInterval(() => heartbeats++, 0);
    const started = Date.now();
    const reduced = await decode(bytes, Object.assign({}, options, { maxEdge: 400 }));
    const reducedMs = Date.now() - started;
    clearInterval(timer);
    assert.equal(reduced.width, 400);
    assert.equal(reduced.height, 300);
    assert.equal(reduced.data.length, 400 * 300 * 3);
    assert(heartbeats > 0, "UI timers must run during decoding");
    for (let y = 0; y < 300; y += 19) for (let x = 0; x < 400; x += 17) {
        const source = (y * 4 * width + x * 4) * 3;
        const target = (y * 400 + x) * 3;
        assert.deepStrictEqual(reduced.data.slice(target, target + 3), expected.data.slice(source, source + 3));
    }
    let checks = 0;
    await assert.rejects(decode(bytes, { checkCancelled() {
        if (++checks > 10) { const error = new Error("cancelled"); error.name = "StaleImageRequestError"; throw error; }
    } }), { name: "StaleImageRequestError" });
    await assert.rejects(decode(new Uint8Array([1, 2, 3])));
    await assert.rejects(decode(bytes, { maxResolutionInMP: 0.01 }), /maxResolution/);
    await assert.rejects(decode(bytes, { maxMemoryUsageInMB: 0.01 }), /maxMemory/);
    const concurrent = await Promise.all([decode(bytes, { maxEdge: 100 }), decode(bytes, { maxEdge: 200 })]);
    assert.equal(concurrent[0].width, 100);
    assert.equal(concurrent[1].width, 200);
    let coldChecks = 0, warmChecks = 0;
    const coldStart = Date.now();
    await decode(bytes, Object.assign({}, options, { cacheKey: "foreground", maxEdge: 400,
        checkCancelled() { coldChecks++; } }));
    const coldMs = Date.now() - coldStart;
    const warmStart = Date.now();
    const reused = await decode(bytes, Object.assign({}, options, { cacheKey: "foreground", maxEdge: 800,
        checkCancelled() { warmChecks++; } }));
    const warmMs = Date.now() - warmStart;
    const reference800 = await decode(bytes, Object.assign({}, options, { maxEdge: 800 }));
    assert.deepStrictEqual(reused.data, reference800.data, "cached planes must produce identical zoom pixels");
    assert(warmChecks < coldChecks / 2, "warm zoom must skip entropy and IDCT decoding");
    assert.equal(decode.snapshot().entries, 1);
    assert(decode.snapshot().bytes <= 192 * 1024 * 1024);
    await assert.rejects(decode(bytes, { cacheKey: "foreground", maxMemoryUsageInMB: 0.01 }), /maxMemory/);
    decode.clear();
    assert.deepStrictEqual(decode.snapshot(), { entries: 0, bytes: 0 });
    const realTimeout = global.setTimeout;
    const expirations = [];
    global.setTimeout = (callback, delay, ...args) => delay === 30000
        ? (expirations.push(callback), { unref() {} }) : realTimeout(callback, delay, ...args);
    try {
        const releaseA = decode.retain(), releaseB = decode.retain();
        await decode(bytes, Object.assign({}, options, { cacheKey: "held", maxEdge: 400 }));
        assert.equal(expirations.length, 0, "visible popup must not arm idle eviction");
        releaseA(); releaseA();
        assert.equal(expirations.length, 0, "duplicate release cannot evict another viewer");
        const heldZoom = await decode(bytes, Object.assign({}, options, { cacheKey: "held", maxEdge: 800 }));
        assert(heldZoom.reused);
        releaseB();
        assert.equal(expirations.length, 1, "last popup close starts idle expiry");
        expirations[0]();
        assert.deepStrictEqual(decode.snapshot(), { entries: 0, bytes: 0 });
    } finally {
        global.setTimeout = realTimeout;
        decode.clear();
    }
    console.log(JSON.stringify({ diagnostic: "Synthetic 1600x1200; not Photoshop timing", coldMs, warmMs, coldChecks, warmChecks }));
    console.log("PASS cooperative JPEG: original parity, bounded RGB, timer yielding, cancellation, malformed input, memory limits, serial requests.");
    console.log(JSON.stringify({ diagnostic: "Node synthetic JPEG; not Photoshop timing", reducedMs,
        heartbeats, originalRGBBytes: expected.data.length, reducedRGBBytes: reduced.data.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
