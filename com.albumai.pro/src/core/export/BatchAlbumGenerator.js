import ExportManager from "./ExportManager";
import Logger from "../photoshop/Logger";

export default class BatchAlbumGenerator {

    constructor({

        exportManager = new ExportManager()

    } = {}) {

        this.exportManager = exportManager;

        this.cancelled = false;

    }

    async generate(projects = [], {

        onStart = () => {},

        onAlbumStart = () => {},

        onAlbumComplete = () => {},

        onProgress = () => {},

        onComplete = () => {},

        onError = () => {}

    } = {}) {

        this.cancelled = false;

        const results = [];

        onStart({

            total: projects.length

        });

        for (let index = 0; index < projects.length; index++) {

            if (this.cancelled) {

                break;

            }

            const project = projects[index];

            try {

                onAlbumStart({

                    index: index + 1,

                    total: projects.length,

                    project

                });

                const result = await this.exportManager.export(

                    project,

                    {

                        onProgress

                    }

                );

                results.push(result);

                onAlbumComplete({

                    index: index + 1,

                    total: projects.length,

                    result

                });

            }

            catch (error) {

                Logger.error(error);

                results.push({

                    success: false,

                    projectId: project?.id,

                    error: error.message

                });

                onError({

                    index: index + 1,

                    total: projects.length,

                    error

                });

            }

        }

        onComplete(results);

        return results;

    }

    cancel() {

        this.cancelled = true;

        this.exportManager.cancel();

    }

    isCancelled() {

        return this.cancelled;

    }

}