import Logger from "../photoshop/Logger";

export default class AlbumValidator {

    validate(project) {

        const errors = [];

        if (!project) {

            errors.push("Project is required.");

            return {

                valid: false,

                errors

            };

        }

        if (!project.name) {

            errors.push(

                "Project name is missing."

            );

        }

        if (!project.template) {

            errors.push(

                "Template is missing."

            );

        }

        if (

            !Array.isArray(project.photos)

        ) {

            errors.push(

                "Photos must be an array."

            );

        }
        else if (

            project.photos.length === 0

        ) {

            errors.push(

                "No photos selected."

            );

        }

        if (

            !project.outputFolder

        ) {

            errors.push(

                "Output folder is missing."

            );

        }

        const valid =

            errors.length === 0;

        if (valid) {

            Logger.info(

                "Album validation successful."

            );

        }
        else {

            Logger.warn(

                `Album validation failed (${errors.length} error(s)).`

            );

        }

        return {

            valid,

            errors

        };

    }

    validatePhotos(photos = []) {

        return photos.every(

            photo =>

                photo &&

                typeof photo === "object"

        );

    }

    validateTemplate(template) {

        return !!template;

    }

    validateOutputFolder(folder) {

        return !!folder;

    }

}