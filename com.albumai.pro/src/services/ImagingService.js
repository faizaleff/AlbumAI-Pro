import { imaging } from "photoshop";

const DEFAULT_SIZE = 256;
const PLACEHOLDER_THUMBNAIL =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect width='100%25' height='100%25' fill='%233a3a3a'/%3E%3Cpath d='M48 192h160L160 112l-32 40-24-24z' fill='%23666'/%3E%3Ccircle cx='96' cy='96' r='16' fill='%23666'/%3E%3C/svg%3E";

class ImagingService {

    constructor() {

        this.createImageFromFile =
            typeof imaging?.createImageFromFile === "function"
                ? imaging.createImageFromFile.bind(imaging)
                : null;
        this.supported = !!this.createImageFromFile;
        this.reportedCapabilities = false;

    }

    async createThumbnail(photo, size = DEFAULT_SIZE) {

        if (!photo) {
            return null;
        }

        try {

            // Already loaded
            if (photo.thumbnail) {
                return photo.thumbnail;
            }

            if (!photo.file || !this.createImageFromFile) {
                this.warnUnavailable();
                return this.placeholder(photo);
            }

            // Prevent duplicate requests
            if (photo.loading) {
                return null;
            }

            photo.loading = true;

            let image = null;
            let blob = null;
            let url = null;

            try {

                image = await this.createImageFromFile(photo.file);

                blob = await image.getPixels({
                    targetSize: {
                        width: size,
                        height: size
                    },
                    componentSize: 8
                });

                url = URL.createObjectURL(blob);

                photo.thumbnail = url;

                return url;

            } finally {

                photo.loading = false;

                if (image?.dispose) {
                    image.dispose();
                }

            }

        } catch (error) {

            photo.loading = false;

            console.warn(
                "ImagingService.createThumbnail",
                error
            );

            return this.placeholder(photo);

        }

    }

    revokeThumbnail(photo) {

        if (!photo?.thumbnail) {
            return;
        }

        try {

            URL.revokeObjectURL(photo.thumbnail);

        } catch (_) {}

        photo.thumbnail = null;

    }

    clear(photos = []) {

        for (const photo of photos) {

            this.revokeThumbnail(photo);

        }

    }

    isSupported() {

        return this.supported;

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

        console.warn(
            "Photoshop imaging.createImageFromFile is unavailable; using placeholder thumbnails.",
            {
                hasImagingModule: !!imaging,
                createImageFromFile: typeof imaging?.createImageFromFile
            }
        );

    }

}

export default new ImagingService();
