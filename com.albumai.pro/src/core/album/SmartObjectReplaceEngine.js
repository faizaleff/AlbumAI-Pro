import Logger from "../photoshop/Logger";

export default class SmartObjectReplaceEngine {

    constructor({

        smartObjectEditor,

        photoTransformEngine,

        progressService

    }) {

        this.smartObjectEditor =
            smartObjectEditor;

        this.photoTransformEngine =
            photoTransformEngine;

        this.progressService =
            progressService;

    }

    async replace({

        assignments = []

    }) {

        const results = [];

        const total =
            assignments.length;

        for (

            let index = 0;

            index < total;

            index++

        ) {

            const {

                frame,

                photo

            } = assignments[index];

            const transform =
                this.photoTransformEngine.calculate({

                    imageWidth:
                        photo.width,

                    imageHeight:
                        photo.height,

                    frameWidth:
                        frame.bounds.width,

                    frameHeight:
                        frame.bounds.height,

                    fit: "cover",

                    gravity: "center"

                });

            await this.smartObjectEditor.replace({

                layer: frame,

                image: photo,

                transform: {

                    scaleX:
                        transform.fit.scale * 100,

                    scaleY:
                        transform.fit.scale * 100,

                    offsetX:
                        transform.fit.offsetX,

                    offsetY:
                        transform.fit.offsetY

                }

            });

            results.push({

                frame,

                photo

            });

            if (

                this.progressService

            ) {

                this.progressService.update({

                    current: index + 1,

                    total

                });

            }

        }

        Logger.info(

            `${results.length} Smart Objects replaced.`

        );

        return results;

    }

}