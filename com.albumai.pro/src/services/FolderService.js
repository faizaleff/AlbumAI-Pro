import { storage } from "uxp";

import Photo from "../models/Photo";
import ThumbnailQueue from "../queue/ThumbnailQueue";
import { isImage } from "../utils/FileUtils";

const BATCH_SIZE = 200;

export async function openWeddingFolder() {

    const folder =
        await storage.localFileSystem.getFolder();

    if (!folder) {
        return null;
    }

    const files = await folder.getEntries();

    ThumbnailQueue.clear();

    const images = [];

    let batch = [];

    for (const file of files) {

        if (!isImage(file)) {
            continue;
        }

        const photo = new Photo(file);

        images.push(photo);
        batch.push(photo);

        if (batch.length >= BATCH_SIZE) {

            ThumbnailQueue.addBatch(batch);

            batch = [];

        }

    }

    if (batch.length) {

        ThumbnailQueue.addBatch(batch);

    }

    return {
        folder,
        images
    };

}