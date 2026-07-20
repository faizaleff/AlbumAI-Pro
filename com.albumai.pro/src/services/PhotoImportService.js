import Logger from "../core/photoshop/Logger";

export default class PhotoImportService {

    constructor({
        photoManager,
        validationService
    }) {

        this.photoManager = photoManager;
        this.validationService = validationService;

    }

    async import(folder) {

        if (!folder)
            throw new Error(
                "Photo folder not selected."
            );

        Logger.info(
            `Importing photos from ${folder.name}`
        );

        const photos =
            await this.photoManager.load(folder);

        this.validationService.validatePhotos(
            photos
        );

        photos.sort((a, b) =>
            a.name.localeCompare(
                b.name,
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            )
        );

        Logger.info(
            `${photos.length} photos imported.`
        );

        return photos;

    }

    async reload(folder) {

        return this.import(folder);

    }

    count(photos) {

        return Array.isArray(photos)
            ? photos.length
            : 0;

    }

}