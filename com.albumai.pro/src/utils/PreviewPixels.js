// Display-ready RGBA pixels: no lossy JPEG re-encode on the interactive path.
// Photoshop UXP 7+ accepts ImageBlob; older hosts get a lossless stored PNG.
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
}

function chunk(type, data) {
    const out = new Uint8Array(data.length + 12);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[i + 4] = type.charCodeAt(i);
    out.set(data, 8);
    let crc = -1;
    for (let i = 4; i < out.length - 4; i++) crc = crcTable[(crc ^ out[i]) & 255] ^ (crc >>> 8);
    view.setUint32(out.length - 4, (crc ^ -1) >>> 0);
    return out;
}

export async function rgbaPng(data, width, height, check = () => {}) {
    const rowSize = width * 4 + 1;
    const raw = new Uint8Array(rowSize * height);
    for (let y = 0; y < height; y++) {
        if ((y & 63) === 0) { check(); await new Promise(resolve => setTimeout(resolve, 0)); }
        raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * rowSize + 1);
    }
    const zlib = new Uint8Array(6 + raw.length + Math.ceil(raw.length / 65535) * 5);
    zlib.set([0x78, 0x01]);
    let offset = 2, a = 1, b = 0;
    for (let start = 0; start < raw.length; start += 65535) {
        check();
        const count = Math.min(65535, raw.length - start);
        zlib.set([start + count === raw.length ? 1 : 0, count & 255, count >>> 8,
            (~count) & 255, ((~count) >>> 8) & 255], offset);
        offset += 5;
        zlib.set(raw.subarray(start, start + count), offset);
        offset += count;
        for (let i = start; i < start + count; i++) { a = (a + raw[i]) % 65521; b = (b + a) % 65521; }
        if ((start / 65535 & 15) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    new DataView(zlib.buffer).setUint32(offset, ((b << 16) | a) >>> 0);
    const header = new Uint8Array(13), headerView = new DataView(header.buffer);
    headerView.setUint32(0, width); headerView.setUint32(4, height);
    header.set([8, 6], 8);
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header)];
    for (let start = 0; start < zlib.length; start += 1048576) {
        check();
        parts.push(chunk("IDAT", zlib.subarray(start, start + 1048576)));
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    parts.push(chunk("IEND", new Uint8Array()));
    return new Blob(parts, { type: "image/png" });
}

export async function previewPixelBlob(data, width, height, check) {
    if (typeof ImageBlob === "function") {
        try {
            // Photoshop 27.4 requires the typed pixel view despite the API
            // table saying ArrayBuffer (Adobe's examples also pass a view).
            return new ImageBlob(data, { type: "image/uncompressed", width, height,
                colorSpace: "RGB", components: 4, componentSize: 8, pixelFormat: "RGBA", hasAlpha: true });
        } catch (_) { /* Host capability varies; keep the portable fallback. */ }
    }
    return rgbaPng(data, width, height, check);
}
