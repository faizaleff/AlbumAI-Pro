import jpeg from "jpeg-js";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const EMBEDDED_DECODE_RESOLUTION_MP = 2;
const EMBEDDED_DECODE_MEMORY_MB = 32;
// Evidence from the no-preview test folder: 990 files are 10800x3600
// (38.88 MP). jpeg-js needs just under 800 MB of guarded allocations for
// that RGB decode. Concurrency remains one and the decoded pixels are never
// cached.
const FULL_DECODE_RESOLUTION_MP = 40;
const FULL_DECODE_MEMORY_MB = 820;
const CONTENT_FINGERPRINT_CHUNKS = 64;
const CONTENT_FINGERPRINT_CHUNK_BYTES = 512;

function binaryView(binary) {

    if (binary instanceof ArrayBuffer) return new Uint8Array(binary);
    if (ArrayBuffer.isView(binary)) {
        return new Uint8Array(
            binary.buffer,
            binary.byteOffset,
            binary.byteLength
        );
    }
    throw new TypeError("JPEG source is not binary data.");

}

function targetDimensions(width, height, maxEdge) {

    if (!(width > 0) || !(height > 0) || !(maxEdge > 0)) {
        throw new Error("JPEG dimensions are invalid.");
    }
    const scale = Math.min(
        1,
        maxEdge / Math.max(width, height)
    );
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };

}

function parseExifPreview(bytes, markerOffset, segmentEnd) {

    const tiffOffset = markerOffset + 10;
    const littleEndian =
        bytes[tiffOffset] === 0x49 &&
        bytes[tiffOffset + 1] === 0x49;
    const bigEndian =
        bytes[tiffOffset] === 0x4d &&
        bytes[tiffOffset + 1] === 0x4d;
    if (!littleEndian && !bigEndian) return null;

    const read16 = offset => littleEndian
        ? bytes[offset] | (bytes[offset + 1] << 8)
        : (bytes[offset] << 8) | bytes[offset + 1];
    const read32 = offset => littleEndian
        ? (
            bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24)
        ) >>> 0
        : (
            bytes[offset] * 0x1000000 +
            bytes[offset + 1] * 0x10000 +
            bytes[offset + 2] * 0x100 +
            bytes[offset + 3]
        ) >>> 0;
    if (
        tiffOffset + 8 > segmentEnd ||
        read16(tiffOffset + 2) !== 42
    ) return null;

    const ifd0Offset = tiffOffset + read32(tiffOffset + 4);
    if (ifd0Offset + 2 > segmentEnd) return null;
    const ifd0Entries = read16(ifd0Offset);
    const nextIfdPointer =
        ifd0Offset + 2 + ifd0Entries * 12;
    if (nextIfdPointer + 4 > segmentEnd) return null;

    let orientation = 1;
    for (let index = 0; index < ifd0Entries; index++) {
        const entryOffset = ifd0Offset + 2 + index * 12;
        if (entryOffset + 12 > segmentEnd) return null;
        if (read16(entryOffset) === 0x0112) {
            const value = read16(entryOffset + 8);
            if (value >= 1 && value <= 8) orientation = value;
        }
    }

    const ifd1Relative = read32(nextIfdPointer);
    if (!ifd1Relative) {
        return { binary: null, orientation };
    }
    const ifd1Offset = tiffOffset + ifd1Relative;
    if (ifd1Offset + 2 > segmentEnd) {
        return { binary: null, orientation };
    }

    const ifd1Entries = read16(ifd1Offset);
    let thumbnailRelative = 0;
    let thumbnailLength = 0;
    for (let index = 0; index < ifd1Entries; index++) {
        const entryOffset = ifd1Offset + 2 + index * 12;
        if (entryOffset + 12 > segmentEnd) {
            return { binary: null, orientation };
        }
        const tag = read16(entryOffset);
        if (tag === 0x0201) {
            thumbnailRelative = read32(entryOffset + 8);
        } else if (tag === 0x0202) {
            thumbnailLength = read32(entryOffset + 8);
        }
    }

    const thumbnailOffset = tiffOffset + thumbnailRelative;
    const thumbnailEnd = thumbnailOffset + thumbnailLength;
    if (
        !thumbnailRelative ||
        !thumbnailLength ||
        thumbnailOffset < tiffOffset ||
        thumbnailEnd > segmentEnd ||
        bytes[thumbnailOffset] !== 0xff ||
        bytes[thumbnailOffset + 1] !== 0xd8
    ) {
        return { binary: null, orientation };
    }
    return {
        binary: bytes.slice(thumbnailOffset, thumbnailEnd),
        orientation
    };

}

function inspectJpeg(binary) {

    const bytes = binaryView(binary);
    if (
        bytes.length < 4 ||
        bytes[0] !== 0xff ||
        bytes[1] !== 0xd8
    ) return { embedded: null, orientation: 1 };

    let best = null;
    let orientation = 1;
    let markerOffset = 2;
    while (
        markerOffset + 4 <= bytes.length &&
        bytes[markerOffset] === 0xff
    ) {
        const marker = bytes[markerOffset + 1];
        if (marker === 0xda || marker === 0xd9) break;
        const segmentLength =
            (bytes[markerOffset + 2] << 8) |
            bytes[markerOffset + 3];
        const segmentEnd = markerOffset + 2 + segmentLength;
        if (segmentLength < 2 || segmentEnd > bytes.length) break;

        const isExif =
            marker === 0xe1 &&
            segmentLength >= 8 &&
            bytes[markerOffset + 4] === 0x45 &&
            bytes[markerOffset + 5] === 0x78 &&
            bytes[markerOffset + 6] === 0x69 &&
            bytes[markerOffset + 7] === 0x66 &&
            bytes[markerOffset + 8] === 0 &&
            bytes[markerOffset + 9] === 0;
        if (isExif) {
            const candidate = parseExifPreview(
                bytes,
                markerOffset,
                segmentEnd
            );
            if (candidate) {
                orientation = candidate.orientation;
                if (
                    candidate.binary &&
                    (
                        !best ||
                        candidate.binary.length > best.binary.length
                    )
                ) {
                    best = candidate;
                }
            }
        }
        markerOffset = segmentEnd;
    }
    return {
        embedded: best?.binary || null,
        orientation: best?.orientation || orientation
    };

}

function decodeJpeg(binary, embedded) {

    return jpeg.decode(binaryView(binary), {
        useTArray: true,
        formatAsRGBA: false,
        tolerantDecoding: true,
        maxResolutionInMP: embedded
            ? EMBEDDED_DECODE_RESOLUTION_MP
            : FULL_DECODE_RESOLUTION_MP,
        maxMemoryUsageInMB: embedded
            ? EMBEDDED_DECODE_MEMORY_MB
            : FULL_DECODE_MEMORY_MB
    });

}

function hashByte(hash, value) {

    hash ^= value;
    return Math.imul(hash, 16777619);

}

function contentFingerprint(binary) {

    const bytes = binaryView(binary);
    let first = 2166136261;
    let second = 2246822519;
    const chunkCount = Math.min(
        CONTENT_FINGERPRINT_CHUNKS,
        Math.max(1, Math.ceil(
            bytes.length / CONTENT_FINGERPRINT_CHUNK_BYTES
        ))
    );
    for (let chunk = 0; chunk < chunkCount; chunk++) {
        const start = chunkCount === 1
            ? 0
            : Math.floor(
                (bytes.length - CONTENT_FINGERPRINT_CHUNK_BYTES) *
                chunk /
                (chunkCount - 1)
            );
        const end = Math.min(
            bytes.length,
            start + CONTENT_FINGERPRINT_CHUNK_BYTES
        );
        for (let index = start; index < end; index++) {
            first = hashByte(first, bytes[index]);
            second ^= bytes[index] + 0x9e3779b9;
            second = Math.imul(second, 1597334677);
            second ^= second >>> 13;
        }
    }
    for (let shift = 0; shift < 32; shift += 8) {
        const value = (bytes.length >>> shift) & 0xff;
        first = hashByte(first, value);
        second = hashByte(second, value ^ 0xa5);
    }
    return [
        bytes.length.toString(36),
        (first >>> 0).toString(36),
        (second >>> 0).toString(36)
    ].join("-");

}

function failureReason(error) {

    const message = String(error?.message || "");
    if (message.includes("maxMemoryUsageInMB")) {
        return "DECODE_MEMORY_LIMIT";
    }
    if (message.includes("maxResolutionInMP")) {
        return "DECODE_RESOLUTION_LIMIT";
    }
    if (error?.name === "EmbeddedJpegUnavailableError") {
        return "EMBEDDED_JPEG_UNAVAILABLE";
    }
    return "JPEG_DECODE_OR_ENCODE_ERROR";

}

function orientedDimensions(width, height, orientation) {

    const swapsAxes = orientation >= 5 && orientation <= 8;
    return {
        width: swapsAxes ? height : width,
        height: swapsAxes ? width : height
    };

}

function sourceCoordinates(
    orientedX,
    orientedY,
    width,
    height,
    orientation
) {

    switch (orientation) {
        case 2:
            return { x: width - 1 - orientedX, y: orientedY };
        case 3:
            return {
                x: width - 1 - orientedX,
                y: height - 1 - orientedY
            };
        case 4:
            return { x: orientedX, y: height - 1 - orientedY };
        case 5:
            return { x: orientedY, y: orientedX };
        case 6:
            return { x: orientedY, y: height - 1 - orientedX };
        case 7:
            return {
                x: width - 1 - orientedY,
                y: height - 1 - orientedX
            };
        case 8:
            return { x: width - 1 - orientedY, y: orientedX };
        default:
            return { x: orientedX, y: orientedY };
    }

}

function resizeOrientedRgb(
    source,
    sourceWidth,
    sourceHeight,
    width,
    height,
    orientation
) {

    const output = new Uint8Array(width * height * 4);
    const oriented = orientedDimensions(
        sourceWidth,
        sourceHeight,
        orientation
    );
    const xScale = oriented.width / width;
    const yScale = oriented.height / height;
    const sourceIndex = (x, y) => {
        const point = sourceCoordinates(
            x,
            y,
            sourceWidth,
            sourceHeight,
            orientation
        );
        return (point.y * sourceWidth + point.x) * 3;
    };

    // Sample directly into the small target buffer. Orientation is applied
    // while sampling so a second full-resolution oriented buffer is never
    // allocated.
    for (let outputY = 0; outputY < height; outputY++) {
        const orientedY = Math.max(
            0,
            Math.min(
                oriented.height - 1,
                (outputY + 0.5) * yScale - 0.5
            )
        );
        const y0 = Math.floor(orientedY);
        const y1 = Math.min(oriented.height - 1, y0 + 1);
        const yWeight = orientedY - y0;

        for (let outputX = 0; outputX < width; outputX++) {
            const orientedX = Math.max(
                0,
                Math.min(
                    oriented.width - 1,
                    (outputX + 0.5) * xScale - 0.5
                )
            );
            const x0 = Math.floor(orientedX);
            const x1 = Math.min(oriented.width - 1, x0 + 1);
            const xWeight = orientedX - x0;
            const topLeft = sourceIndex(x0, y0);
            const topRight = sourceIndex(x1, y0);
            const bottomLeft = sourceIndex(x0, y1);
            const bottomRight = sourceIndex(x1, y1);
            const outputIndex = (outputY * width + outputX) * 4;

            for (let channel = 0; channel < 3; channel++) {
                const top =
                    source[topLeft + channel] * (1 - xWeight) +
                    source[topRight + channel] * xWeight;
                const bottom =
                    source[bottomLeft + channel] * (1 - xWeight) +
                    source[bottomRight + channel] * xWeight;
                output[outputIndex + channel] = Math.round(
                    top * (1 - yWeight) + bottom * yWeight
                );
            }
            output[outputIndex + 3] = 255;
        }
    }
    return output;

}

class SoftwareJpegRenderer {

    contentIdentity(binary) {

        return contentFingerprint(binary);

    }

    supports(photo) {

        const extension = String(
            photo?.extension || photo?.name || ""
        ).split(".").pop().toLowerCase();
        return extension === "jpg" || extension === "jpeg";

    }

    render(binary, {
        maxEdge,
        quality,
        lifecycle = null
    }) {

        const startedAt = Date.now();
        lifecycle?.throwIfCancelled?.("before-exif-parsing");
        PhotoBrowserPerformance.trace(
            "SOFTWARE_JPEG_RENDER_START",
            { maxEdge }
        );

        try {
            const inspected = inspectJpeg(binary);
            let decoded = null;
            let input = "embedded-exif";
            if (inspected.embedded) {
                try {
                    decoded = decodeJpeg(
                        inspected.embedded,
                        true
                    );
                } catch (_) {
                    input = "full-jpeg";
                }
            } else {
                input = "full-jpeg";
            }
            if (!decoded) {
                lifecycle?.throwIfCancelled?.(
                    "before-full-jpeg-decode"
                );
                decoded = decodeJpeg(binary, false);
                lifecycle?.throwIfCancelled?.(
                    "after-full-jpeg-decode"
                );
            }
            const oriented = orientedDimensions(
                decoded.width,
                decoded.height,
                inspected.orientation
            );
            const dimensions = targetDimensions(
                oriented.width,
                oriented.height,
                maxEdge
            );
            const resized = resizeOrientedRgb(
                decoded.data,
                decoded.width,
                decoded.height,
                dimensions.width,
                dimensions.height,
                inspected.orientation
            );
            lifecycle?.throwIfCancelled?.("before-jpeg-encoding");
            const encoded = jpeg.encode(
                {
                    data: resized,
                    width: dimensions.width,
                    height: dimensions.height
                },
                Math.round(quality * 100)
            );
            lifecycle?.throwIfCancelled?.("before-object-url");
            const source = URL.createObjectURL(
                new Blob([encoded.data], { type: "image/jpeg" })
            );
            PhotoBrowserPerformance.trackObjectUrl(source);

            PhotoBrowserPerformance.trace(
                "SOFTWARE_JPEG_RENDER_SUCCESS",
                {
                    width: dimensions.width,
                    height: dimensions.height,
                    input,
                    orientation: inspected.orientation,
                    elapsedMs: Date.now() - startedAt
                }
            );
            return {
                source,
                width: dimensions.width,
                height: dimensions.height,
                format: "image/jpeg",
                strategy: input === "embedded-exif"
                    ? "embedded-exif-jpeg"
                    : "full-jpeg-software",
                ownedObjectUrl: true,
                reduced: true
            };
        } catch (error) {
            if (error?.name === "StaleImageRequestError") throw error;
            PhotoBrowserPerformance.trace(
                "SOFTWARE_JPEG_RENDER_FAILURE",
                {
                    errorName: error?.name || "Error",
                    reason: failureReason(error),
                    elapsedMs: Date.now() - startedAt
                }
            );
            throw error;
        }

    }

}

export default new SoftwareJpegRenderer();
