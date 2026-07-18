import ImagingService from "./ImagingService";
import ThumbnailCache from "../cache/ThumbnailCache";

class ThumbnailService {

    async getThumbnail(photo) {

        if (!photo) {

            return null;

        }

        const key = photo.file?.nativePath || photo.name;

        if (ThumbnailCache.has(key)) {

            return ThumbnailCache.get(key);

        }

        try {

            const thumbnail = await ImagingService.createThumbnail(photo);

            if (thumbnail) {

                ThumbnailCache.set(key, thumbnail);

            }

            return thumbnail;

        } catch (error) {

            console.error("ThumbnailService:", error);

            return null;

        }

    }

    setThumbnail(key, thumbnail) {

        ThumbnailCache.set(key, thumbnail);

    }

    hasThumbnail(key) {

        return ThumbnailCache.has(key);

    }

    clear() {

        ThumbnailCache.clear();

    }

}

export default new ThumbnailService();