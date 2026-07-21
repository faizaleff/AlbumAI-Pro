import SmartObjectManager from "./SmartObjectManager";
import ImageFitService from "./ImageFitService";
import ImageTransformService from "./ImageTransformService";
import FileTokenManager from "../files/FileTokenManager";
import Logger from "./Logger";

export default class PhotoReplacementPipeline {

    constructor({

        smartObjects = new SmartObjectManager(),

        imageFit = new ImageFitService(),

        imageTransform = new ImageTransformService(),

        fileTokens = new FileTokenManager()

    } = {}) {

        this.smartObjects = smartObjects;

        this.imageFit = imageFit;

        this.imageTransform = imageTransform;

        this.fileTokens = fileTokens;

    }

    async execute({

        layerId,

        image,

        frame,

        mode = "cover"

    }) {

        let token = null;

        try {

            token = await this.fileTokens.createSessionToken(

                image

            );

            await this.smartObjects.open(

                layerId

            );

            await this.smartObjects.replaceContents(

                token

            );

            const fit = this.imageFit.calculate({

                imageWidth: image.width,

                imageHeight: image.height,

                frameWidth: frame.width,

                frameHeight: frame.height,

                mode

            });

            await this.imageTransform.fit(

                layerId,

                fit

            );

            await this.smartObjects.save();

            await this.smartObjects.close();

            return {

                success: true,

                layerId,

                image: image.name,

                fit

            };

        }

        catch (error) {

            Logger.error(error);

            await this.rollback();

            throw error;

        }

    }

    async rollback() {

        try {

            await this.smartObjects.close();

        }

        catch (e) {

            Logger.error(e);

        }

    }

    async executeBatch({

        jobs = [],

        onProgress = () => {}

    }) {

        const results = [];

        const total = jobs.length;

        for (let i = 0; i < total; i++) {

            const result = await this.execute(

                jobs[i]

            );

            results.push(result);

            onProgress({

                current: i + 1,

                total,

                result

            });

        }

        return results;

    }

}