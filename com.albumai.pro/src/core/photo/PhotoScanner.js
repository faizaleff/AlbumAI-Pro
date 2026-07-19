// src/core/photo/PhotoScanner.js

import { SupportedExtensions, PhotoStatus } from "./PhotoTypes";

class PhotoScanner {

    constructor({
        fileSystem,
        collection
    }) {

        if (!fileSystem)
            throw new Error("FileSystem adapter is required.");

        if (!collection)
            throw new Error("PhotoCollection is required.");

        this.fileSystem = fileSystem;
        this.collection = collection;

    }

    /**
     * Scan a folder recursively.
     * @param {Folder} folder
     * @returns {Promise<Array>}
     */
    async scan(folder) {

        if (!folder)
            throw new Error("Folder is required.");

        const files = [];

        await this.walk(folder, files);

        this.collection.addMany(files);

        return files;

    }

    /**
     * Recursive directory traversal.
     */
    async walk(folder, output) {

        const entries = await this.fileSystem.read(folder);

        for (const entry of entries) {

            if (entry.isFolder) {

                await this.walk(entry, output);

                continue;

            }

            if (!this.isSupported(entry.name))
                continue;

            output.push(this.createPhoto(entry));

        }

    }

    /**
     * Create photo model.
     */
    createPhoto(file) {

        return {

            id: this.createId(file),

            name: file.name,

            file,

            extension: this.extension(file.name),

            status: PhotoStatus.SCANNED,

            metadata: null,

            analysis: null,

            duplicate: false,

            matched: false

        };

    }

    /**
     * Stable ID.
     */
    createId(file) {

        return `${file.name}_${file.nativePath}`;

    }

    /**
     * Extension.
     */
    extension(name) {

        const index = name.lastIndexOf(".");

        if (index === -1)
            return "";

        return name.substring(index).toLowerCase();

    }

    /**
     * Supported image?
     */
    isSupported(name) {

        return SupportedExtensions.includes(
            this.extension(name)
        );

    }

}

export default PhotoScanner;