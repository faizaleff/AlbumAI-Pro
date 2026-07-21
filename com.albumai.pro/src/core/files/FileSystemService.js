import { storage } from "uxp";
import Logger from "../photoshop/Logger";

const fs = storage.localFileSystem;

export default class FileSystemService {

    constructor() {

        this.supportedExtensions = [
            ".jpg",
            ".jpeg",
            ".png",
            ".tif",
            ".tiff",
            ".psd"
        ];

    }

    async pickFolder() {

        return await fs.getFolder();

    }

    async pickFile(types = []) {

        return await fs.getFileForOpening({
            types
        });

    }

    async createFolder(parent, name) {

        try {

            return await parent.createFolder(
                name
            );

        }

        catch (error) {

            Logger.error(error);
            throw error;

        }

    }

    async getEntries(folder) {

        return await folder.getEntries();

    }

    async getImages(folder) {

        const images = [];

        await this.scan(folder, images);

        return images;

    }

    async scan(folder, images) {

        const entries =
            await folder.getEntries();

        for (const entry of entries) {

            if (entry.isFolder) {

                await this.scan(
                    entry,
                    images
                );

                continue;

            }

            if (
                this.isSupportedImage(
                    entry.name
                )
            ) {

                images.push(entry);

            }

        }

    }

    isSupportedImage(name) {

        const file =
            name.toLowerCase();

        return this.supportedExtensions.some(
            ext => file.endsWith(ext)
        );

    }

    async findPSDTemplates(folder) {

        const templates = [];

        const entries =
            await folder.getEntries();

        for (const entry of entries) {

            if (entry.isFolder) {

                templates.push(
                    ...(await this.findPSDTemplates(
                        entry
                    ))
                );

                continue;

            }

            if (
                entry.name
                    .toLowerCase()
                    .endsWith(".psd")
            ) {

                templates.push(entry);

            }

        }

        return templates;

    }

    async ensureFolder(parent, name) {

        const entries =
            await parent.getEntries();

        const existing =
            entries.find(

                item =>
                    item.isFolder &&
                    item.name === name

            );

        if (existing) {

            return existing;

        }

        return await parent.createFolder(
            name
        );

    }

    async createFile(folder, name) {

        return await folder.createFile(
            name,
            {
                overwrite: true
            }
        );

    }

}