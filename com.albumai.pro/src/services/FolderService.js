import { storage } from "uxp";

import Photo from "../models/Photo";
import ThumbnailQueue from "../queue/ThumbnailQueue";
import { isImage } from "../utils/FileUtils";

export async function openWeddingFolder() {

    const folder = await storage.localFileSystem.getFolder();

    if (!folder) return null;

    const files = await folder.getEntries();

    const images = [];

    ThumbnailQueue.clear();

    for (const file of files) {

        if (!isImage(file)) continue;

        const photo = new Photo(file);

        images.push(photo);

        ThumbnailQueue.add(photo);

    }

    return {
        folder,
        images
    };

}