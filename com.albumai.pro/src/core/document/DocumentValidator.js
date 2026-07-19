// src/core/document/DocumentValidator.js

class DocumentValidator {

    /**
     * Validate an opened Photoshop document.
     * @param {Document} document
     * @returns {{valid:boolean, errors:string[], warnings:string[]}}
     */
    validate(document) {

        const errors = [];
        const warnings = [];

        if (!document) {
            errors.push("Document is null.");
            return this.result(errors, warnings);
        }

        this.validateBasic(document, errors);
        this.validateDimensions(document, warnings);
        this.validateLayers(document, warnings);
        this.validateColorMode(document, warnings);
        this.validateResolution(document, warnings);

        return this.result(errors, warnings);

    }

    validateBasic(document, errors) {

        if (!document.id)
            errors.push("Document ID is missing.");

        if (!document.title)
            errors.push("Document title is missing.");

    }

    validateDimensions(document, warnings) {

        if (
            document.width <= 0 ||
            document.height <= 0
        ) {

            warnings.push(
                "Invalid document dimensions."
            );

        }

    }

    validateLayers(document, warnings) {

        if (
            document.layers &&
            document.layers.length === 0
        ) {

            warnings.push(
                "Document contains no layers."
            );

        }

    }

    validateColorMode(document, warnings) {

        if (!document.mode)
            return;

        const supported = [
            "RGBColorMode",
            "RGB"
        ];

        if (!supported.includes(document.mode)) {

            warnings.push(
                `Unsupported color mode: ${document.mode}`
            );

        }

    }

    validateResolution(document, warnings) {

        if (!document.resolution)
            return;

        if (document.resolution < 300) {

            warnings.push(
                "Resolution is below 300 DPI."
            );

        }

    }

    result(errors, warnings) {

        return {

            valid: errors.length === 0,

            errors,

            warnings

        };

    }

}

export default DocumentValidator;