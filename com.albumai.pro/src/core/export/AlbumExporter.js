import PSDExporter from "./PSDExporter";
import Logger from "../photoshop/Logger";

export default class AlbumExporter {

    constructor({

        psdExporter = new PSDExporter()

    } = {}) {

        this.psdExporter = psdExporter;

    }

    async export(project) {

        if (!project) {

            throw new Error(
                "Project is required."
            );

        }

        Logger.info(

            `Exporting album: ${project.name}`

        );

        const result =

            await this.psdExporter.export({

                template:

                    project.template,

                output:

                    project.outputFolder,

                assignments:

                    project.assignments || [],

                onProgress:

                    project.onProgress ||

                    (() => {})

            });

        Logger.info(

            "Album export completed."

        );

        return {

            success: true,

            projectId: project.id,

            output:

                result.output

        };

    }

    async exportBatch(projects = []) {

        const results = [];

        for (const project of projects) {

            try {

                results.push(

                    await this.export(project)

                );

            }

            catch (error) {

                Logger.error(error);

                results.push({

                    success: false,

                    projectId: project.id,

                    error: error.message

                });

            }

        }

        return results;

    }

}