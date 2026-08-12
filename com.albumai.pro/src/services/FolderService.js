import { storage } from "uxp";

import Photo from "../models/Photo";
import { isImage } from "../utils/FileUtils";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const BROWSER_RENDERABLE_EXTENSIONS = new Set([
    "jpg",
    "jpeg"
]);

export function isBrowserRenderableImage(value) {

    const name = typeof value === "string"
        ? value
        : value?.name || "";
    const index = name.lastIndexOf(".");
    const extension = index < 0
        ? ""
        : name.substring(index + 1).toLowerCase();
    return BROWSER_RENDERABLE_EXTENSIONS.has(extension);

}

export async function openWeddingFolder() {

    const folder =
        await storage.localFileSystem.getFolder();

    if (!folder) {
        return null;
    }

    return importPhotoFolder(folder);

}

export async function importPhotoFolder(folder) {

    if (!folder) {
        return null;
    }

    PhotoBrowserPerformance.markEnumerationStart();
    const files = await folder.getEntries();
    PhotoBrowserPerformance.markEnumerationComplete();

    // Filter entries before constructing models or reading image data.
    PhotoBrowserPerformance.markFilteringStart();
    const regularFiles = files.filter(file => !file.isFolder);
    const imageFiles = regularFiles.filter(
        file => !file.isFolder && isImage(file.name)
    );
    const browserRenderableFiles = imageFiles.filter(
        file => isBrowserRenderableImage(file)
    );
    PhotoBrowserPerformance.markFilteringComplete();
    PhotoBrowserPerformance.markMetadataStart();
    const images = await Promise.all(imageFiles.map(async file => {
        const photo = new Photo(file);

        if (typeof file?.getMetadata === "function") {
            try {
                const metadata = await file.getMetadata();
                const size = Number(metadata?.size);

                if (Number.isFinite(size) && size >= 0) {
                    photo.fileSize = size;
                }

                photo.created =
                    metadata?.dateCreated ?? photo.created;
                photo.modified =
                    metadata?.dateModified ?? photo.modified;
            } catch (_) {
                // Metadata failure must not hide an otherwise readable photo.
            }
        }

        return photo;
    }));
    PhotoBrowserPerformance.markModelsComplete(images.length);

    return {
        folder,
        images,
        statistics: Object.freeze({
            totalFiles: regularFiles.length,
            recognizedImages: imageFiles.length,
            browserRenderableImages: browserRenderableFiles.length,
            unsupportedRecognizedImages:
                imageFiles.length - browserRenderableFiles.length
        })
    };

}
