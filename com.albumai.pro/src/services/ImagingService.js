import { app, core, imaging } from "photoshop";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const DEFAULT_SIZE = 200;
const PLACEHOLDER_THUMBNAIL =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect width='100%25' height='100%25' fill='%233a3a3a'/%3E%3Cpath d='M48 192h160L160 112l-32 40-24-24z' fill='%23666'/%3E%3Ccircle cx='96' cy='96' r='16' fill='%23666'/%3E%3C/svg%3E";

// Photoshop determines whether HEIC/HEIF is available on the current host.
const SUPPORTED_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "tif", "tiff", "psd", "heic", "heif"
]);
const DOCUMENT_FALLBACK_FEATURE_FLAG =
    "__ALBUMAI_ENABLE_DOCUMENT_THUMBNAIL_FALLBACK__";

class ImagingService {

    constructor() {

        this.reportedCapabilities = false;
        // The documented Imaging API has no FileEntry decoder. Keep the
        // legacy document path opt-in until Adobe exposes one.
        this.documentFallbackEnabled =
            globalThis[DOCUMENT_FALLBACK_FEATURE_FLAG] === true;

    }

    async createThumbnail(photo, size = DEFAULT_SIZE) {

        if (!photo) return null;

        if (photo.thumbnail) return photo.thumbnail;

        if (!photo.file) return null;

        if (!this.isSupported()) {
            this.warnUnavailable();
            return this.unavailablePlaceholder(photo);
        }

        if (!this.supportsPhoto(photo)) {
            this.reportUnsupported(photo);
            return null;
        }

        if (!this.canUseDocumentFallback()) {
            PhotoBrowserPerformance.trace(
                "THUMBNAIL_DIRECT_FILE_UNSUPPORTED",
                {
                    name: photo.name || "unnamed",
                    documentFallbackEnabled:
                        this.documentFallbackEnabled,
                    activeDocumentId: app.activeDocument?.id || null
                }
            );
            return null;
        }

        if (photo.loading) return null;

        photo.loading = true;
        const diagnosticName = photo.name || "unnamed";

        try {

            return await this.createThumbnailFromDocumentFallback(
                photo,
                size,
                diagnosticName
            );

        } catch (error) {

            PhotoBrowserPerformance.trace(
                "THUMBNAIL_CREATE_ERROR",
                {
                    name: diagnosticName,
                    message: error?.message || String(error)
                }
            );
            console.warn("Thumbnail generation failed:", diagnosticName, error);
            return null;

        } finally {

            photo.loading = false;

        }

    }

    async createThumbnailFromDocumentFallback(
        photo,
        size,
        diagnosticName
    ) {

        return core.executeAsModal(async () => {

                // This method is reached only when there is no active document.
                // It never replaces a user document's visible focus.
                let document = null;
                let imageData = null;

                try {

                    PhotoBrowserPerformance.trace(
                        "THUMBNAIL_CREATE_BEGIN",
                        { name: diagnosticName, size }
                    );

                    // Opening the source lets Photoshop decode JPEG, PNG, TIFF,
                    // PSD, and host-supported HEIC/HEIF files. Pixels are requested
                    // directly at tile size; no full-resolution buffer enters UXP.
                    document = await app.open(photo.file);
                    PhotoBrowserPerformance.documentOpened(document.id);
                    const width = Number(document.width) || size;
                    const height = Number(document.height) || size;
                    const pixels = await imaging.getPixels({
                        documentID: document.id,
                        sourceBounds: {
                            left: 0,
                            top: 0,
                            right: width,
                            bottom: height
                        },
                        targetSize: {
                            width: size,
                            height: size
                        },
                        componentSize: 8
                    });
                    imageData = pixels?.imageData || null;
                    if (imageData) PhotoBrowserPerformance.imageBufferAcquired();

                    if (!imageData) {
                        throw new Error("Photoshop returned no thumbnail image data.");
                    }

                    PhotoBrowserPerformance.trace(
                        "THUMBNAIL_PIXELS_READY",
                        {
                            name: diagnosticName,
                            width: imageData.width,
                            height: imageData.height,
                            level: pixels?.level ?? null
                        }
                    );
                    const base64 = await imaging.encodeImageData({
                        imageData,
                        base64: true
                    });
                    const thumbnail = `data:image/jpeg;base64,${base64}`;

                    PhotoBrowserPerformance.trace(
                        "THUMBNAIL_URL_ASSIGNED",
                        { name: diagnosticName, encoding: "jpeg/base64" }
                    );
                    photo.thumbnail = thumbnail;
                    return thumbnail;

                } finally {

                    if (imageData?.dispose) imageData.dispose();
                    if (imageData) PhotoBrowserPerformance.imageBufferReleased();

                    if (document) {
                        await document.close({ save: false });
                        PhotoBrowserPerformance.documentClosed(document.id);
                    }

                }

        }, { commandName: "Generate AlbumAI Thumbnail" });

    }

    setDocumentFallbackEnabled(enabled) {

        this.documentFallbackEnabled = enabled === true;

    }

    canUseDocumentFallback() {

        // Opening a file activates it in Photoshop. Only permit the legacy
        // fallback in an empty workspace, where it cannot steal user focus.
        return this.documentFallbackEnabled && !app.activeDocument;

    }

    supportsPhoto(photo) {

        const extension = (photo.extension || photo.name || "")
            .split(".").pop().toLowerCase();

        return SUPPORTED_EXTENSIONS.has(extension);

    }

    reportUnsupported(photo) {

        PhotoBrowserPerformance.trace("THUMBNAIL_UNSUPPORTED_FORMAT", {
            name: photo.name || "unnamed",
            extension: photo.extension || null
        });

    }

    isSupported() {

        return !!app &&
            typeof app.open === "function" &&
            typeof core?.executeAsModal === "function" &&
            typeof imaging?.getPixels === "function" &&
            typeof imaging?.encodeImageData === "function";

    }

    capability() {

        return {
            moduleAvailable: !!imaging,
            directFileThumbnails: false,
            documentFallbackEnabled: this.documentFallbackEnabled,
            openAvailable: typeof app?.open === "function",
            getPixelsAvailable: typeof imaging?.getPixels === "function",
            encodeImageDataAvailable:
                typeof imaging?.encodeImageData === "function",
            reason: this.isSupported()
                ? "available"
                : "required Photoshop Imaging API unavailable"
        };

    }

    unavailablePlaceholder(photo) {

        // The sole placeholder case is a host without the documented API.
        photo.thumbnail = PLACEHOLDER_THUMBNAIL;
        return photo.thumbnail;

    }

    isPlaceholder(thumbnail) {

        return thumbnail === PLACEHOLDER_THUMBNAIL;

    }

    warnUnavailable() {

        if (this.reportedCapabilities) return;

        this.reportedCapabilities = true;
        PhotoBrowserPerformance.trace(
            "IMAGING_CAPABILITY_UNAVAILABLE",
            this.capability()
        );
        console.warn(
            "Photoshop Imaging API unavailable; using placeholder thumbnails.",
            this.capability()
        );

    }

}

export default new ImagingService();
