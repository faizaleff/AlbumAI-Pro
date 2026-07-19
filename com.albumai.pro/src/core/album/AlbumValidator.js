// src/core/album/AlbumValidator.js

class AlbumValidator {

    /**
     * Validate an AlbumJob.
     * @param {AlbumJob} job
     * @returns {{valid:boolean, errors:string[], warnings:string[]}}
     */
    validate(job) {

        const errors = [];
        const warnings = [];

        if (!job)
            errors.push("Album job is required.");

        if (errors.length) {
            return {
                valid: false,
                errors,
                warnings
            };
        }

        this.validateTemplate(job.template, errors);
        this.validatePhotos(job.photos, errors, warnings);
        this.validateOutput(job.outputFolder, errors);
        this.validateExport(job.exportOptions, warnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };

    }

    validateTemplate(template, errors) {

        if (!template) {
            errors.push("Template is missing.");
            return;
        }

        if (!template.file)
            errors.push("Template file is missing.");

        if (template.pageCount <= 0)
            errors.push("Invalid page count.");

        if (template.smartObjectCount <= 0)
            errors.push("No Smart Objects found.");

    }

    validatePhotos(photos, errors, warnings) {

        if (!Array.isArray(photos)) {
            errors.push("Photos must be an array.");
            return;
        }

        if (photos.length === 0)
            errors.push("No photos selected.");

        if (photos.length < 10)
            warnings.push("Very few photos selected.");

    }

    validateOutput(folder, errors) {

        if (!folder)
            errors.push("Output folder not selected.");

    }

    validateExport(options, warnings) {

        if (!options)
            return;

        if (!options.formats || options.formats.length === 0)
            warnings.push("No export format selected.");

        if (options.jpegQuality != null) {

            if (
                options.jpegQuality < 1 ||
                options.jpegQuality > 100
            ) {

                warnings.push(
                    "JPEG quality should be between 1 and 100."
                );

            }

        }

    }

}

export default AlbumValidator;