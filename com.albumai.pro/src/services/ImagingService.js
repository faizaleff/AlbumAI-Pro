import { imaging } from "photoshop";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const DEFAULT_SIZE = 200;
const PLACEHOLDER_THUMBNAIL =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect width='100%25' height='100%25' fill='%233a3a3a'/%3E%3Cpath d='M48 192h160L160 112l-32 40-24-24z' fill='%23666'/%3E%3Ccircle cx='96' cy='96' r='16' fill='%23666'/%3E%3C/svg%3E";

class ImagingService {

    constructor() {

        this.reportedCapabilities = false;

    }

    async createThumbnail(photo, size = DEFAULT_SIZE) {

        if (!photo) {
            return null;
        }

        const diagnosticName = photo.name || "unnamed";

        try {

            // Already loaded
            if (photo.thumbnail) {
                return photo.thumbnail;
            }

            if (!photo.file) {
                return this.placeholder(photo);
            }

            const createImageFromFile = this.imageFactory();

            if (!createImageFromFile) {
                this.warnUnavailable();
                return this.placeholder(photo);
            }

            // Prevent duplicate requests
            if (photo.loading) {
                return null;
            }

            photo.loading = true;

            let image = null;

            try {

                PhotoBrowserPerformance.trace(
                    "THUMBNAIL_CREATE_BEGIN",
                    {
                        name: diagnosticName,
                        size
                    }
                );
                image = await createImageFromFile(photo.file);
                PhotoBrowserPerformance.trace(
                    "THUMBNAIL_IMAGE_CREATED",
                    {
                        name: diagnosticName,
                        disposable: !!image?.dispose
                    }
                );

                PhotoBrowserPerformance.trace(
                    "THUMBNAIL_PIXELS_BEGIN",
                    { name: diagnosticName }
                );
                const blob = await image.getPixels({
                    targetSize: {
                        width: size,
                        height: size
                    },
                    componentSize: 8
                });
                PhotoBrowserPerformance.trace(
                    "THUMBNAIL_PIXELS_READY",
                    {
                        name: diagnosticName,
                        blobType: blob?.type || typeof blob
                    }
                );
                const url = PhotoBrowserPerformance.trackObjectUrl(
                    URL.createObjectURL(blob)
                );
                PhotoBrowserPerformance.trace(
                    "THUMBNAIL_URL_ASSIGNED",
                    {
                        name: diagnosticName,
                        urlId:
                            PhotoBrowserPerformance
                                .getObjectUrlId(url)
                    }
                );

                photo.thumbnail = url;

                return url;

            } finally {

                photo.loading = false;

                if (image?.dispose) {
                    PhotoBrowserPerformance.trace(
                        "THUMBNAIL_DISPOSE_BEFORE",
                        { name: diagnosticName }
                    );
                    image.dispose();
                    PhotoBrowserPerformance.trace(
                        "THUMBNAIL_DISPOSE_AFTER",
                        { name: diagnosticName }
                    );
                }

            }

        } catch (error) {

            photo.loading = false;
            PhotoBrowserPerformance.trace(
                "THUMBNAIL_CREATE_ERROR",
                {
                    name: diagnosticName,
                    message: error?.message || String(error)
                }
            );

            return this.placeholder(photo);

        }

    }

    revokeThumbnail(photo) {

        if (!photo?.thumbnail) {
            return;
        }

        try {

            PhotoBrowserPerformance.trace(
                "THUMBNAIL_REVOKE_REQUEST",
                {
                    name: photo.name || "unnamed",
                    urlId: PhotoBrowserPerformance
                        .getObjectUrlId(photo.thumbnail)
                }
            );
            PhotoBrowserPerformance.releaseObjectUrl(photo.thumbnail);

        } catch (_) {}

        photo.thumbnail = null;

    }

    clear(photos = []) {

        for (const photo of photos) {

            this.revokeThumbnail(photo);

        }

    }

    isSupported() {

        return !!this.imageFactory();

    }

    capability() {

        const moduleAvailable = !!imaging;
        const methodType =
            typeof imaging?.createImageFromFile;
        const methodAvailable = methodType === "function";

        return {
            moduleAvailable,
            methodAvailable,
            methodType,
            reason: !moduleAvailable
                ? "photoshop.imaging module unavailable"
                : !methodAvailable
                    ? "imaging.createImageFromFile unsupported"
                    : "available"
        };

    }

    placeholderThumbnail(photo) {

        return this.placeholder(photo);

    }

    isPlaceholder(thumbnail) {

        return thumbnail === PLACEHOLDER_THUMBNAIL;

    }

    imageFactory() {

        try {

            return typeof imaging?.createImageFromFile === "function"
                ? imaging.createImageFromFile.bind(imaging)
                : null;

        }

        catch (_) {
            return null;
        }

    }

    placeholder(photo) {

        photo.thumbnail = PLACEHOLDER_THUMBNAIL;

        return photo.thumbnail;

    }

    warnUnavailable() {

        if (this.reportedCapabilities) {
            return;
        }

        this.reportedCapabilities = true;

        PhotoBrowserPerformance.trace(
            "IMAGING_CAPABILITY_UNAVAILABLE",
            this.capability()
        );

        console.warn(
            "Host imaging API unavailable; using placeholder thumbnails.",
            this.capability()
        );

    }

}

export default new ImagingService();
