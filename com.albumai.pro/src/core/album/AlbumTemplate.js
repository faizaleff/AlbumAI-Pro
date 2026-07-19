// src/core/album/AlbumTemplate.js

class AlbumTemplate {

    constructor(options = {}) {

        this.id = options.id ?? null;

        this.name = options.name ?? "";

        this.file = options.file ?? null;

        this.pageCount = options.pageCount ?? 0;

        this.smartObjectCount =
            options.smartObjectCount ?? 0;

        this.width = options.width ?? 0;

        this.height = options.height ?? 0;

        this.resolution =
            options.resolution ?? 300;

        this.metadata =
            options.metadata ?? {};

    }

    isLoaded() {

        return !!this.file;

    }

    size() {

        return {

            width: this.width,

            height: this.height

        };

    }

    aspectRatio() {

        if (!this.height)
            return 0;

        return this.width / this.height;

    }

    summary() {

        return {

            id: this.id,

            name: this.name,

            pages: this.pageCount,

            placeholders:
                this.smartObjectCount,

            resolution:
                this.resolution

        };

    }

}

export default AlbumTemplate;