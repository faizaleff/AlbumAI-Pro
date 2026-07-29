import PhotoBrowserPerformance from "./PhotoBrowserPerformance";
import { getCanonicalPhotoEntry } from "./PhotoFileEntry";
import SoftwareJpegRenderer from "./SoftwareJpegRenderer";

const TEST_TIMEOUT_MS = 5000;
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

function schemeOf(value) {

    if (typeof value !== "string") return null;
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(value);
    return match ? match[1].toLowerCase() : null;

}

function mimeType(photo) {

    const extension = String(
        photo?.extension || photo?.name || ""
    ).split(".").pop().toLowerCase();

    return {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        tif: "image/tiff",
        tiff: "image/tiff",
        webp: "image/webp",
        heic: "image/heic",
        heif: "image/heif"
    }[extension] || "application/octet-stream";

}

function fileUrlFromNativePath(path) {

    if (typeof path !== "string" || !path.trim()) return null;
    const normalized = path.replace(/\\/g, "/");
    return encodeURI(
        `${normalized.startsWith("/") ? "file://" : "file:///"}${normalized}`
    );

}

function binaryView(binary) {

    if (binary instanceof ArrayBuffer) return new Uint8Array(binary);
    if (ArrayBuffer.isView(binary)) {
        return new Uint8Array(
            binary.buffer,
            binary.byteOffset,
            binary.byteLength
        );
    }
    throw new TypeError("Binary File.read() did not return an ArrayBuffer.");

}

function binaryToDataUrl(binary, type) {

    const bytes = binaryView(binary);
    const chunkSize = 0x8000;
    let encoded = "";
    for (let index = 0; index < bytes.length; index += chunkSize) {
        encoded += String.fromCharCode.apply(
            null,
            bytes.subarray(index, index + chunkSize)
        );
    }
    return `data:${type};base64,${btoa(encoded)}`;

}

function loadImage(source, timeoutMs = TEST_TIMEOUT_MS) {

    return new Promise(resolve => {
        const startedAt = Date.now();
        let image;
        try {
            image = document.createElement("img");
            image.setAttribute("aria-hidden", "true");
            image.style.position = "fixed";
            image.style.left = "-10000px";
            image.style.top = "-10000px";
            image.style.width = "1px";
            image.style.height = "1px";
            image.style.opacity = "0.001";
            image.style.pointerEvents = "none";
            const parent = document.body || document.documentElement;
            if (!parent || typeof parent.appendChild !== "function") {
                throw new Error("No DOM decode host is available.");
            }
            parent.appendChild(image);
        } catch (error) {
            resolve({
                image: null,
                attached: false,
                loaded: false,
                timeout: false,
                width: 0,
                height: 0,
                elapsedMs: Date.now() - startedAt,
                errorName: error?.name || "ImageUnavailable"
            });
            return;
        }

        let settled = false;
        let timer = null;
        const finish = result => {
            if (settled) return;
            settled = true;
            if (timer != null) clearTimeout(timer);
            image.onload = null;
            image.onerror = null;
            resolve({
                image,
                attached: !!image.parentNode,
                elapsedMs: Date.now() - startedAt,
                ...result
            });
        };

        timer = setTimeout(() => finish({
            loaded: false,
            timeout: true,
            width: 0,
            height: 0,
            errorName: "TimeoutError"
        }), timeoutMs);
        image.onload = () => finish({
            loaded: true,
            timeout: false,
            width: image.naturalWidth || image.width || 0,
            height: image.naturalHeight || image.height || 0,
            errorName: null
        });
        image.onerror = event => finish({
            loaded: false,
            timeout: false,
            width: 0,
            height: 0,
            errorName: event?.error?.name || event?.type || "ImageError"
        });

        try {
            image.src = source;
        } catch (error) {
            finish({
                loaded: false,
                timeout: false,
                width: 0,
                height: 0,
                errorName: error?.name || "TypeError"
            });
        }
    });

}

let canvasSupportResult = null;

function supportsCanvas() {

    if (canvasSupportResult != null) return canvasSupportResult;
    try {
        const canvas = document.createElement("canvas");
        canvasSupportResult = !!canvas &&
            typeof canvas.getContext === "function" &&
            !!canvas.getContext("2d") &&
            typeof canvas.toDataURL === "function";
    } catch (_) {
        canvasSupportResult = false;
    }
    return canvasSupportResult;

}

function targetDimensions(width, height, maxEdge) {

    if (!(width > 0) || !(height > 0)) {
        throw new Error("Decoded image dimensions are unavailable.");
    }
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };

}

function releaseImage(image) {

    if (!image) return;
    image.onload = null;
    image.onerror = null;
    try {
        image.src = "";
    } catch (_) {}
    try {
        image.parentNode?.removeChild(image);
    } catch (_) {}

}

function revokeObjectUrl(source) {

    if (
        typeof source !== "string" ||
        !source.startsWith("blob:") ||
        typeof URL?.revokeObjectURL !== "function"
    ) return;
    try {
        URL.revokeObjectURL(source);
    } catch (_) {}

}

class ImageSourceCapabilityService {

    constructor() {

        this.probePromise = null;
        this.probeResult = null;
        this.probeAttempted = false;
        this.binaryReads = new Map();

    }

    readBinary(photo) {

        const { candidate } = getCanonicalPhotoEntry(photo);
        const key = candidate?.nativePath ||
            photo?.id ||
            candidate?.name ||
            photo?.name;
        if (!key) {
            return Promise.reject(
                new Error("A stable photo identity is required.")
            );
        }
        if (this.binaryReads.has(key)) return this.binaryReads.get(key);

        if (!candidate || typeof candidate.read !== "function") {
            return Promise.reject(
                new Error("The UXP File does not expose read().")
            );
        }

        const formats = require("uxp").storage.formats;
        const pending = Promise.resolve(candidate.read({
            format: formats.binary
        })).finally(() => this.binaryReads.delete(key));
        this.binaryReads.set(key, pending);
        return pending;

    }

    supportsReducedProfiles(photoOrPhotos = null) {

        if (Array.isArray(photoOrPhotos)) {
            return photoOrPhotos.length > 0 &&
                photoOrPhotos.every(photo =>
                    SoftwareJpegRenderer.supports(photo)
                );
        }
        return SoftwareJpegRenderer.supports(photoOrPhotos);

    }

    startDevelopmentProbe(photo) {

        if (!IS_DEVELOPMENT || this.probeAttempted) return;
        this.probe(photo).catch(() => {});

    }

    probe(photo) {

        if (!IS_DEVELOPMENT) return Promise.resolve(null);
        if (this.probeResult) return Promise.resolve(this.probeResult);
        if (this.probePromise) return this.probePromise;
        if (this.probeAttempted) return Promise.resolve(null);

        this.probeAttempted = true;
        this.probePromise = this.runProbe(photo)
            .then(result => {
                this.probeResult = result;
                return result;
            })
            .finally(() => {
                this.probePromise = null;
            });
        return this.probePromise;

    }

    async testSource(
        strategy,
        value,
        cleanup = null,
        resolutionError = null
    ) {

        const valueType = value === null ? "null" : typeof value;
        const scheme = schemeOf(value);
        let outcome;
        if (valueType !== "string" || !value.trim()) {
            outcome = {
                image: null,
                loaded: false,
                timeout: false,
                width: 0,
                height: 0,
                elapsedMs: 0,
                errorName:
                    resolutionError?.name || "UnsupportedSource"
            };
        } else {
            outcome = await loadImage(value);
        }

        PhotoBrowserPerformance.trace("IMAGE_SOURCE_CAPABILITY_RESULT", {
            strategy,
            valueType,
            scheme,
            attached: outcome.attached === true,
            loaded: outcome.loaded,
            width: outcome.width,
            height: outcome.height,
            elapsedMs: outcome.elapsedMs,
            timeout: outcome.timeout,
            errorName: outcome.errorName
        });
        releaseImage(outcome.image);
        try {
            cleanup?.();
        } catch (_) {}
        return {
            loaded: outcome.loaded,
            width: outcome.width,
            height: outcome.height,
            elapsedMs: outcome.elapsedMs,
            timeout: outcome.timeout,
            errorName: outcome.errorName
        };

    }

    async runProbe(photo) {

        const { candidate } = getCanonicalPhotoEntry(photo);
        let fsUrl = null;
        let fsUrlError = null;
        try {
            fsUrl = require("uxp").storage.localFileSystem.getFsUrl(candidate);
            if (typeof fsUrl?.then === "function") {
                fsUrl = await fsUrl;
            }
        } catch (error) {
            fsUrlError = error;
        }
        const directUrl = candidate?.url;
        let sessionToken = null;
        try {
            sessionToken = require("uxp").storage.localFileSystem
                .createSessionToken(candidate);
        } catch (_) {}
        const nativeFileUrl = fileUrlFromNativePath(candidate?.nativePath);
        const results = {};

        results.A = await this.testSource(
            "A_GET_FS_URL",
            fsUrl,
            null,
            fsUrlError
        );
        results.B = await this.testSource("B_ENTRY_URL", directUrl);
        results.C = await this.testSource("C_SESSION_TOKEN", sessionToken);
        results.D = await this.testSource(
            "D_NATIVE_PATH_FILE_URL",
            nativeFileUrl
        );

        let binary = null;
        let binaryError = null;
        try {
            binary = await this.readBinary(photo);
        } catch (error) {
            binaryError = error;
        }
        if (!binary) {
            for (const strategy of [
                "E_BINARY_BLOB_URL",
                "F_BINARY_DATA_URL",
                "G_CANVAS_JPEG"
            ]) {
                PhotoBrowserPerformance.trace(
                    "IMAGE_SOURCE_CAPABILITY_RESULT",
                    {
                        strategy,
                        valueType: "undefined",
                        scheme: null,
                        loaded: false,
                        width: 0,
                        height: 0,
                        elapsedMs: 0,
                        timeout: false,
                        errorName:
                            binaryError?.name || "BinaryReadError"
                    }
                );
            }
            return { results, firstWorking: null, canvas: false };
        }

        const type = mimeType(photo);
        let blobUrl = null;
        try {
            blobUrl = URL.createObjectURL(new Blob([binary], { type }));
        } catch (_) {}
        results.E = await this.testSource(
            "E_BINARY_BLOB_URL",
            blobUrl,
            () => revokeObjectUrl(blobUrl)
        );

        let dataUrl = null;
        try {
            dataUrl = binaryToDataUrl(binary, type);
        } catch (_) {}
        results.F = await this.testSource("F_BINARY_DATA_URL", dataUrl);
        results.G = await this.testCanvasCapability(binary, type);

        const firstWorking = ["A", "B", "E", "F", "G"]
            .find(strategy => results[strategy]?.loaded) || null;
        return {
            results,
            firstWorking,
            canvas: results.G?.loaded === true
        };

    }

    async testCanvasCapability(binary, type) {

        if (!supportsCanvas()) {
            return this.testSource("G_CANVAS_JPEG", null);
        }
        const original = await this.loadBinarySource(binary, type);
        if (!original) {
            return this.testSource("G_CANVAS_JPEG", null);
        }

        let rendered = null;
        try {
            const dimensions = targetDimensions(
                original.width,
                original.height,
                200
            );
            const canvas = document.createElement("canvas");
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
            canvas.getContext("2d").drawImage(
                original.image,
                0,
                0,
                dimensions.width,
                dimensions.height
            );
            rendered = canvas.toDataURL("image/jpeg", 0.6);
        } catch (_) {
            rendered = null;
        } finally {
            releaseImage(original.image);
            if (original.ownedObjectUrl) {
                revokeObjectUrl(original.source);
            }
        }
        return this.testSource("G_CANVAS_JPEG", rendered);

    }

    async loadBinarySource(binary, type) {

        let blobUrl = null;
        try {
            blobUrl = URL.createObjectURL(new Blob([binary], { type }));
            const blobResult = await loadImage(blobUrl);
            if (blobResult.loaded) {
                return {
                    source: blobUrl,
                    image: blobResult.image,
                    width: blobResult.width,
                    height: blobResult.height,
                    strategy: "binary-blob-url",
                    ownedObjectUrl: true
                };
            }
            releaseImage(blobResult.image);
        } catch (_) {}
        revokeObjectUrl(blobUrl);

        let dataUrl = null;
        try {
            dataUrl = binaryToDataUrl(binary, type);
            const dataResult = await loadImage(dataUrl);
            if (dataResult.loaded) {
                return {
                    source: dataUrl,
                    image: dataResult.image,
                    width: dataResult.width,
                    height: dataResult.height,
                    strategy: "binary-data-url",
                    ownedObjectUrl: false
                };
            }
            releaseImage(dataResult.image);
        } catch (_) {}
        return null;

    }

    async renderProfile(photo, {
        maxEdge,
        quality,
        lifecycle = null,
        resolveCachedSource = null
    }) {

        lifecycle?.throwIfCancelled?.("before-read");
        const binary = await this.readBinary(photo);
        lifecycle?.throwIfCancelled?.("after-read");
        if (!SoftwareJpegRenderer.supports(photo)) {
            const error = new Error(
                "Embedded JPEG previews are unavailable for this format."
            );
            error.name = "EmbeddedPreviewUnsupportedFormatError";
            throw error;
        }
        const contentIdentity =
            SoftwareJpegRenderer.contentIdentity(binary);
        const cached = resolveCachedSource?.(contentIdentity);
        if (cached?.source) {
            return {
                source: cached.source,
                width: null,
                height: null,
                format: "image/jpeg",
                strategy: "content-cache",
                ownedObjectUrl: false,
                reduced: true,
                contentIdentity,
                cacheKey: cached.cacheKey
            };
        }
        return {
            ...SoftwareJpegRenderer.render(binary, {
                maxEdge,
                quality,
                lifecycle
            }),
            contentIdentity
        };

    }

    dispose(source) {

        PhotoBrowserPerformance.releaseObjectUrl(source);

    }

}

export default new ImageSourceCapabilityService();
