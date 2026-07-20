import Logger from "../photoshop/Logger";

export default class PhotoPlacementEngine {

    constructor({

        documentManager,

        smartObjectService,

        progressService

    }) {

        this.documentManager =
            documentManager;

        this.smartObjectService =
            smartObjectService;

        this.progressService =
            progressService;

    }

    async place({

        document,

        frames,

        photos

    }) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

        if (!frames?.length) {

            throw new Error(
                "No frames found."
            );

        }

        const placed = [];

        for (

            let index = 0;

            index < frames.length;

            index++

        ) {

            const frame =
                frames[index];

            const photo =
                photos[index];

            if (!photo) {

                break;

            }

            await this.smartObjectService.replace({

                layer: frame,

                image: photo

            });

            placed.push({

                frame,

                photo

            });

            if (this.progressService) {

                this.progressService.update({

                    current: index + 1,

                    total: frames.length

                });

            }

        }

        Logger.info(

            `${placed.length} photos placed.`

        );

        return placed;

    }

}