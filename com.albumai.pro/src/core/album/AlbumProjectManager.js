import FileSystemService from "../files/FileSystemService";
import Logger from "../photoshop/Logger";

export default class AlbumProjectManager {

    constructor({

        fileSystem = new FileSystemService()

    } = {}) {

        this.fileSystem = fileSystem;

        this.project = null;

    }

    create({

        name,

        template,

        photoFolder,

        outputFolder,

        settings = {}

    }) {

        this.project = {

            id: crypto.randomUUID(),

            name,

            template,

            photoFolder,

            outputFolder,

            createdAt: new Date().toISOString(),

            updatedAt: new Date().toISOString(),

            status: "idle",

            progress: 0,

            settings,

            albums: [],

            metadata: {}

        };

        return this.project;

    }

    load(project) {

        this.project = project;

        return this.project;

    }

    get() {

        return this.project;

    }

    update(values = {}) {

        if (!this.project) {

            throw new Error(

                "Project not loaded."

            );

        }

        Object.assign(

            this.project,

            values,

            {

                updatedAt:

                    new Date().toISOString()

            }

        );

        return this.project;

    }

    setStatus(status) {

        return this.update({

            status

        });

    }

    setProgress(progress) {

        return this.update({

            progress

        });

    }

    addAlbum(album) {

        this.project.albums.push(album);

        this.project.updatedAt =

            new Date().toISOString();

    }

    removeAlbum(id) {

        this.project.albums =

            this.project.albums.filter(

                album => album.id !== id

            );

    }

    findAlbum(id) {

        return this.project.albums.find(

            album => album.id === id

        );

    }

    async save(folder) {

        try {

            const file =

                await this.fileSystem.createFile(

                    folder,

                    `${this.project.name}.json`

                );

            await file.write(

                JSON.stringify(

                    this.project,

                    null,

                    2

                )

            );

            return file;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async open(file) {

        try {

            const content =

                await file.read();

            this.project = JSON.parse(

                content

            );

            return this.project;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    clear() {

        this.project = null;

    }

}