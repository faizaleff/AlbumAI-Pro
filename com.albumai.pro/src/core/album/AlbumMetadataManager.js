import Logger from "../photoshop/Logger";
import AlbumMetadata from "./AlbumMetadata";

export default class AlbumMetadataManager {

    constructor(initialData = {}) {

        this.metadata =
            new AlbumMetadata(initialData);

    }

    get(key, defaultValue = null) {

        return this.metadata.get(

            key,

            defaultValue

        );

    }

    set(key, value) {

        const result =

            this.metadata.set(

                key,

                value

            );

        Logger.info(

            `Metadata updated: ${key}`

        );

        return result;

    }

    update(values = {}) {

        return this.metadata.update(values);

    }

    incrementPhotoCount(count = 1) {

        this.metadata.incrementPhotoCount(count);

    }

    incrementPageCount(count = 1) {

        this.metadata.incrementPageCount(count);

    }

    markGenerated() {

        this.metadata.markGenerated();

        Logger.info(

            "Album generation timestamp recorded."

        );

    }

    export() {

        return this.metadata.export();

    }

    reset() {

        this.metadata.reset();

    }

    setAlbum(id, name) {

        this.update({

            albumId: id,

            albumName: name

        });

    }

    setTemplate(id, name) {

        this.update({

            templateId: id,

            templateName: name

        });

    }

    setOutputFolder(folder) {

        this.set(

            "outputFolder",

            folder

        );

    }

    setAuthor(author) {

        this.set(

            "author",

            author

        );

    }

    setVersion(version) {

        this.set(

            "version",

            version

        );

    }

}