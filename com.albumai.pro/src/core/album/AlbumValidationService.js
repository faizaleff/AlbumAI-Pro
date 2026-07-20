import Logger from "../photoshop/Logger";
import AlbumValidator from "./AlbumValidator";

export default class AlbumValidationService {

    constructor() {

        this.validator =
            new AlbumValidator();

    }

    validate(project) {

        const result =
            this.validator.validate(project);

        if (!result.valid) {

            Logger.warn(

                "Album validation failed."

            );

            result.errors.forEach(error =>

                Logger.warn(error)

            );
        }

        return result;

    }

    validateOrThrow(project) {

        const result =
            this.validate(project);

        if (!result.valid) {

            throw new Error(

                result.errors.join("\n")

            );

        }

        return true;

    }

    validatePhotos(photos = []) {

        const valid =

            this.validator.validatePhotos(

                photos

            );

        if (!valid) {

            Logger.warn(

                "Invalid photo collection."

            );

        }

        return valid;

    }

    validateTemplate(template) {

        const valid =

            this.validator.validateTemplate(

                template

            );

        if (!valid) {

            Logger.warn(

                "Template validation failed."

            );

        }

        return valid;

    }

    validateOutputFolder(folder) {

        const valid =

            this.validator.validateOutputFolder(

                folder

            );

        if (!valid) {

            Logger.warn(

                "Output folder validation failed."

            );

        }

        return valid;

    }

    canGenerate(project) {

        return this.validate(project).valid;

    }

}