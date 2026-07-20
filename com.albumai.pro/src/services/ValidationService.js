import Logger from "../core/photoshop/Logger";

export default class ValidationService {

    validateTemplate(template) {

        if (!template)
            throw new Error("Template not selected.");

        return true;

    }

    validatePhotos(photos) {

        if (!Array.isArray(photos))
            throw new Error("Invalid photo collection.");

        if (!photos.length)
            throw new Error("No photos selected.");

        return true;

    }

    validateOutputFolder(folder) {

        if (!folder)
            throw new Error("Output folder not selected.");

        return true;

    }

    validateGeneration(options = {}) {

        this.validateTemplate(options.template);

        this.validatePhotos(options.photos);

        this.validateOutputFolder(options.outputFolder);

        Logger.info("Generation validation successful.");

        return true;

    }

}