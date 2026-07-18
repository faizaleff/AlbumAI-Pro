import { imaging } from "photoshop";

const DEFAULT_SIZE = 256;

class ImagingService {

    constructor() {

        this.supported = !!imaging;

    }

    async createThumbnail(photo, size = DEFAULT_SIZE) {

        if (!this.supported) {
            return null;
        }

        if (!photo?.file) {
            return null;
        }

        try {

            // Already loaded
            if (photo.thumbnail) {
                return photo.thumbnail;
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

                image = await imaging.createImageFromFile(photo.file);

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

            console.error(
                "ImagingService.createThumbnail",
                error
            );

            return null;

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

}

export default new ImagingService();