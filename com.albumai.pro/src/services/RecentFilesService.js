import Logger from "../core/photoshop/Logger";

export default class RecentFilesService {

    constructor(limit = 20) {

        this.limit = limit;

        this.files = [];

    }

    add(file) {

        if (!file)
            return;

        const path =
            file.nativePath ??
            file.path ??
            file.name;

        this.files = this.files.filter(

            item => item.path !== path

        );

        this.files.unshift({

            name:

                file.name ??

                "Unknown",

            path,

            addedAt:

                new Date()

        });

        if (

            this.files.length >

            this.limit

        ) {

            this.files.length =

                this.limit;

        }

        Logger.info(
            `Recent File: ${path}`
        );

    }

    remove(path) {

        this.files = this.files.filter(

            file =>

                file.path !== path

        );

    }

    clear() {

        this.files = [];

    }

    getAll() {

        return [

            ...this.files

        ];

    }

    latest() {

        return this.files[0] ?? null;

    }

    has(path) {

        return this.files.some(

            file =>

                file.path === path

        );

    }

    size() {

        return this.files.length;

    }

}