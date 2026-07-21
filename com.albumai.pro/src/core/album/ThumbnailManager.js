import AlbumCacheManager from "./AlbumCacheManager";
import FileSystemService from "../files/FileSystemService";
import Logger from "../photoshop/Logger";

export default class ThumbnailManager {

    constructor({

        cache = new AlbumCacheManager(),

        fileSystem = new FileSystemService(),

        maxCacheSize = 500

    } = {}) {

        this.cache = cache;
        this.fileSystem = fileSystem;
        this.maxCacheSize = maxCacheSize;

    }

    async generate(key, generator) {

        if (this.cache.has("thumbnails", key)) {

            return this.cache.get(
                "thumbnails",
                key
            );

        }

        const thumbnail = await generator();

        this.cache.set(
            "thumbnails",
            key,
            thumbnail
        );

        this.cleanup();

        return thumbnail;

    }

    async generatePhotoThumbnail(photo, generator) {

        return this.generate(

            photo.nativePath,

            generator

        );

    }

    async generateTemplateThumbnail(template, generator) {

        return this.generate(

            template.nativePath,

            generator

        );

    }

    async generateSheetThumbnail(sheetId, generator) {

        return this.generate(

            `sheet:${sheetId}`,

            generator

        );

    }

    async generatePreview(previewId, generator) {

        return this.generate(

            `preview:${previewId}`,

            generator

        );

    }

    get(key) {

        return this.cache.get(

            "thumbnails",

            key

        );

    }

    has(key) {

        return this.cache.has(

            "thumbnails",

            key

        );

    }

    remove(key) {

        this.cache.remove(

            "thumbnails",

            key

        );

    }

    clear() {

        this.cache.clearCategory(

            "thumbnails"

        );

    }

    async preload(files = [], generator) {

        const thumbnails = [];

        for (const file of files) {

            thumbnails.push(

                await this.generate(

                    file.nativePath,

                    () => generator(file)

                )

            );

        }

        return thumbnails;

    }

    cleanup() {

        const count = this.cache.size(

            "thumbnails"

        );

        if (

            count <= this.maxCacheSize

        ) {

            return;

        }

        this.cache.cleanup();

        Logger.info(

            "Thumbnail cache cleaned."

        );

    }

    statistics() {

        return {

            cached:

                this.cache.size(

                    "thumbnails"

                ),

            limit:

                this.maxCacheSize

        };

    }

}