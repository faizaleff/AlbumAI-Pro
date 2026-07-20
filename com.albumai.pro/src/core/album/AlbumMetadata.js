import Logger from "../photoshop/Logger";

export default class AlbumMetadata {

    constructor(initialData = {}) {

        this.metadata = {

            albumId: null,

            albumName: "",

            templateId: null,

            templateName: "",

            version: "1.0.0",

            createdAt: null,

            updatedAt: null,

            generatedAt: null,

            author: "",

            photoCount: 0,

            pageCount: 0,

            outputFolder: "",

            ...initialData

        };

    }

    get(key, defaultValue = null) {

        return Object.prototype.hasOwnProperty.call(

            this.metadata,

            key

        )
            ? this.metadata[key]
            : defaultValue;

    }

    set(key, value) {

        this.metadata[key] = value;

        this.metadata.updatedAt = new Date();

        return value;

    }

    update(values = {}) {

        Object.assign(

            this.metadata,

            values

        );

        this.metadata.updatedAt = new Date();

        Logger.info(

            "Album metadata updated."

        );

        return this.metadata;

    }

    incrementPhotoCount(count = 1) {

        this.metadata.photoCount += count;

        this.metadata.updatedAt = new Date();

    }

    incrementPageCount(count = 1) {

        this.metadata.pageCount += count;

        this.metadata.updatedAt = new Date();

    }

    markGenerated() {

        this.metadata.generatedAt = new Date();

    }

    reset() {

        this.metadata = {

            albumId: null,

            albumName: "",

            templateId: null,

            templateName: "",

            version: "1.0.0",

            createdAt: null,

            updatedAt: null,

            generatedAt: null,

            author: "",

            photoCount: 0,

            pageCount: 0,

            outputFolder: ""

        };

        Logger.info(

            "Album metadata reset."

        );

    }

    export() {

        return {

            ...this.metadata

        };

    }

}