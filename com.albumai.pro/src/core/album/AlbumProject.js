import Logger from "../photoshop/Logger";

export default class AlbumProject {

    constructor() {

        this.reset();

    }

    create({

        id,

        name,

        template,

        photos = [],

        outputFolder = null,

        options = {}

    }) {

        this.project = {

            id,

            name,

            template,

            photos,

            outputFolder,

            options,

            createdAt: new Date(),

            updatedAt: new Date()

        };

        Logger.info(

            `Project created: ${name}`

        );

        return this.project;

    }

    update(values = {}) {

        if (!this.project) {

            throw new Error(
                "No active project."
            );

        }

        Object.assign(

            this.project,

            values,

            {

                updatedAt: new Date()

            }

        );

        return this.project;

    }

    get() {

        return this.project;

    }

    hasProject() {

        return this.project !== null;

    }

    reset() {

        this.project = null;
    }

    addPhotos(photos = []) {

        if (!this.project) {

            throw new Error(
                "No active project."
            );

        }

        this.project.photos.push(

            ...photos

        );

        this.project.updatedAt =
            new Date();

    }

    setOutputFolder(folder) {

        if (!this.project) {

            throw new Error(
                "No active project."
            );

        }

        this.project.outputFolder =
            folder;

        this.project.updatedAt =
            new Date();

    }

    summary() {

        if (!this.project) {

            return null;

        }

        return {

            id: this.project.id,

            name: this.project.name,

            template:

                this.project.template?.name,

            photos:

                this.project.photos.length,

            outputFolder:

                this.project.outputFolder

        };

    }

}