import { imaging } from "photoshop";

class ImagingService {

    constructor() {

        this.supported = !!imaging;

    }

    async createThumbnail(photo) {

        try {

            if (!this.supported) {

                return null;

            }

            if (!photo || !photo.file) {

                return null;

            }

            // Photoshop Imaging API implementation
            // (next step)

            return null;

        } catch (error) {

            console.error("ImagingService:", error);

            return null;

        }

    }

    isSupported() {

        return this.supported;

    }

}

export default new ImagingService();