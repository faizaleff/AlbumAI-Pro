import Logger from "../photoshop/Logger";

export default class PhotoAssignmentEngine {

    constructor({

        frameDetector

    }) {

        this.frameDetector =
            frameDetector;

    }

    async assign({

        document,

        photos

    }) {

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