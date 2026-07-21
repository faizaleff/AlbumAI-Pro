import Logger from "../photoshop/Logger";

export default class AlbumValidationService {

    validate(project) {

        const report = {

            valid: true,

            errors: [],

            warnings: []

        };

        if (!project) {

            report.errors.push(
                "Project not found."
            );

            report.valid = false;

            return report;

        }

        this.validateTemplate(
            project,
            report
        );

        this.validatePhotoFolder(
            project,
            report
        );

        this.validateOutputFolder(
            project,
            report
        );

        this.validateAssignments(
            project,
            report
        );

        this.validateSlots(
            project,
            report
        );

        this.validateImages(
            project,
            report
        );

        report.valid =
            report.errors.length === 0;

        return report;

    }

    validateTemplate(project, report) {

        if (!project.template) {

            report.errors.push(
                "Template not selected."
            );

        }

    }

    validatePhotoFolder(project, report) {

        if (!project.photoFolder) {

            report.errors.push(
                "Photo folder not selected."
            );

        }

    }

    validateOutputFolder(project, report) {

        if (!project.outputFolder) {

            report.errors.push(
                "Output folder not selected."
            );

        }

    }

    validateAssignments(project, report) {

        const assignments =
            project.assignments || [];

        const used = new Set();

        for (const assignment of assignments) {

            if (!assignment.layerId) {

                report.errors.push(

                    "Missing layer ID."

                );

            }

            if (!assignment.image) {

                report.errors.push(

                    `Layer "${assignment.layerId}" has no assigned image.`

                );

            }

            if (

                assignment.image &&

                used.has(assignment.image)

            ) {

                report.warnings.push(

                    `Duplicate image: ${assignment.image}`

                );

            }

            used.add(
                assignment.image
            );

        }

    }

    validateSlots(project, report) {

        const slots =
            project.slots || [];

        if (slots.length === 0) {

            report.warnings.push(

                "No photo slots detected."

            );

        }

    }

    validateImages(project, report) {

        const images =
            project.images || [];

        if (images.length === 0) {

            report.errors.push(

                "No photos available."

            );

        }

        const slots =
            project.slots || [];

        if (

            slots.length > 0 &&

            images.length < slots.length

        ) {

            report.warnings.push(

                "Photos are fewer than available slots."

            );

        }

    }

    log(report) {

        if (report.valid) {

            Logger.info(

                "Album validation successful."

            );

        } else {

            Logger.error(

                report.errors.join("\n")

            );

        }

        return report;

    }

}