import Logger from "../photoshop/Logger";
import AlbumProject from "./AlbumProject";

export default class AlbumProjectManager {

    constructor() {

        this.project =
            new AlbumProject();

    }

    create(options) {

        const project =
            this.project.create(options);

        Logger.info(
            "Album project initialized."
        );

        return project;

    }

    load(project) {

        this.project.project = {

            ...project,

            updatedAt: new Date()

        };

        Logger.info(
            `Project loaded: ${project.name}`
        );

        return this.project.get();

    }

    save() {

        const project =
            this.project.get();

        if (!project) {

            throw new Error(
                "No active project."
            );

        }

        project.updatedAt =
            new Date();

        Logger.info(
            "Project saved."
        );

        return project;

    }

    close() {

        if (

            !this.project.hasProject()

        ) {

            return;

        }

        Logger.info(
            "Project closed."
        );

        this.project.reset();

    }

    current() {

        return this.project.get();

    }

    summary() {

        return this.project.summary();

    }

    hasProject() {

        return this.project.hasProject();

    }

    addPhotos(photos) {

        this.project.addPhotos(photos);

    }

    setOutputFolder(folder) {

        this.project.setOutputFolder(folder);

    }

}