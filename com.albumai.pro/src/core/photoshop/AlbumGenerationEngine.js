import PhotoshopAdapter from "../photoshop/PhotoshopAdapter";
import TemplateAnalyzer from "../photoshop/TemplateAnalyzer";
import PhotoSlotDetector from "../photoshop/PhotoSlotDetector";
import PhotoPlacementEngine from "../photoshop/PhotoPlacementEngine";
import PSDExporter from "../export/PSDExporter";
import Logger from "../photoshop/Logger";

export default class AlbumGenerationEngine {

    constructor({

        photoshop = new PhotoshopAdapter(),

        analyzer = new TemplateAnalyzer(),

        slotDetector = new PhotoSlotDetector(),

        placementEngine = new PhotoPlacementEngine(),

        exporter = new PSDExporter()

    } = {}) {

        this.photoshop = photoshop;

        this.analyzer = analyzer;

        this.slotDetector = slotDetector;

        this.placementEngine = placementEngine;

        this.exporter = exporter;

        this.cancelled = false;

    }

    async generate({

        template,

        output,

        images = [],

        onProgress = () => {}

    }) {

        this.cancelled = false;

        let document = null;

        try {

            onProgress({

                stage: "opening"

            });

            document = await this.photoshop.openDocument(

                template

            );

            onProgress({

                stage: "analyzing"

            });

            await this.analyzer.analyze(

                document

            );

            const slots =

                await this.slotDetector.detect(

                    document

                );

            slots.forEach(

                (slot, index) => {

                    slot.image =

                        images[index] ||

                        null;

                }

            );

            if (this.cancelled) {

                throw new Error(

                    "Album generation cancelled."

                );

            }

            onProgress({

                stage: "placing"

            });

            await this.placementEngine.place({

                slots,

                onProgress

            });

            if (this.cancelled) {

                throw new Error(

                    "Album generation cancelled."

                );

            }

            onProgress({

                stage: "exporting"

            });

            const result =

                await this.exporter.export({

                    template,

                    output,

                    assignments: slots,

                    onProgress

                });

            onProgress({

                stage: "completed"

            });

            return result;

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

    cancel() {

        this.cancelled = true;

    }

    isCancelled() {

        return this.cancelled;

    }

}