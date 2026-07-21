import PhotoshopAdapter from "../photoshop/PhotoshopAdapter";
import SmartObjectService from "../album/SmartObjectService";
import Logger from "../photoshop/Logger";

export default class PSDExporter {

    constructor({

        photoshop = new PhotoshopAdapter(),

        smartObjects = new SmartObjectService()

    } = {}) {

        this.photoshop = photoshop;

        this.smartObjects = smartObjects;

    }

    async export({

        template,

        output,

        assignments = [],

        onProgress = () => {}

    }) {

        let document = null;

        const total = assignments.length;

        let current = 0;

        try {

            Logger.info(

                "Opening PSD template..."

            );

            document = await this.photoshop.openDocument(

                template

            );

            for (const assignment of assignments) {

                current++;

                onProgress({

                    current,

                    total,

                    stage: "replace"

                });

                await this.smartObjects.replace({

                    document,

                    layerName:

                        assignment.layer,

                    image:

                        assignment.photo

                });

            }

            onProgress({

                current: total,

                total,

                stage: "save"

            });

            await this.photoshop.saveDocumentAs(

                document,

                output

            );

            Logger.info(

                "PSD export completed."

            );

            return {

                success: true,

                output

            };

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

        finally {

            if (document) {

                try {

                    await this.photoshop.closeDocument(

                        document,

                        false

                    );

                }

                catch (e) {

                    Logger.error(e);

                }

            }

        }

    }

}