import AlbumExporter from "./AlbumExporter";
import Logger from "../photoshop/Logger";

export default class ExportManager {

    constructor({

        albumExporter = new AlbumExporter()

    } = {}) {

        this.albumExporter = albumExporter;

        this.running = false;

        this.cancelled = false;

    }

    async export(project, {

        onStart = () => {},

        onProgress = () => {},

        onComplete = () => {},

        onError = () => {}

    } = {}) {

        if (this.running) {

            throw new Error(

                "An export is already running."

            );

        }

        this.running = true;

        this.cancelled = false;

        try {

            onStart(project);

            const result =

                await this.albumExporter.export({

                    ...project,

                    onProgress: progress => {

                        if (this.cancelled) {

                            throw new Error(

                                "Export cancelled."

                            );

                        }

                        onProgress(progress);

                    }

                });

            onComplete(result);

            return result;

        }

        catch (error) {

            Logger.error(error);

            onError(error);

            throw error;

        }

        finally {

            this.running = false;

        }

    }

    async exportBatch(projects = [], callbacks = {}) {

        const results = [];

        for (const project of projects) {

            if (this.cancelled) {

                break;

            }

            results.push(

                await this.export(

                    project,

                    callbacks

                )

            );

        }

        return results;

    }

    cancel() {

        this.cancelled = true;

    }

    isRunning() {

        return this.running;

    }

}