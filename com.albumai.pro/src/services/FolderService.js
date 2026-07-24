import { storage } from "uxp";

import Photo from "../models/Photo";
import { isImage } from "../utils/FileUtils";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

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
    const imageFiles = files.filter(
        file => !file.isFolder && isImage(file.name)
    );
    PhotoBrowserPerformance.markFilteringComplete();
    PhotoBrowserPerformance.markMetadataStart();
    const images = imageFiles.map(file => new Photo(file));
    PhotoBrowserPerformance.markModelsComplete(images.length);

    return {
        folder,
        images
    };

}
