import Logger from "../photoshop/Logger";
import FrameDetector from "./FrameDetector";

export default class PhotoAssignmentEngine {

    constructor({

        frameDetector = new FrameDetector()

    } = {}) {

        this.frameDetector =
            frameDetector;

    }

    async assign({

        document,

        photos

    }) {

        if (!document) {

            throw new Error(

                "Document is required."

            );

        }

        if (!Array.isArray(photos)) {

            throw new Error(

                "Photos must be an array."

            );

        }

        const frames =
            await this.frameDetector.detect(
                document
            );

        const assignments = [];

        const count = Math.min(

            frames.length,

            photos.length

        );

        for (

            let index = 0;

            index < count;

            index++

        ) {

            assignments.push({

                index,

                frame: frames[index],

            photo: photos[index]

            });

        }

        Logger.info(

            `${assignments.length} photo assignments created.`

        );

        return assignments;

    }

    validate(assignments = []) {

        if (!Array.isArray(assignments)) {

            throw new Error(

                "Assignments must be an array."

            );

        }

        const invalid = assignments.filter(

            item =>

                !item.frame ||

                !item.photo

        );

        return {

            valid:

                invalid.length === 0,

            invalid

        };

    }

}
