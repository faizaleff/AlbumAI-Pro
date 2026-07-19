// src/core/photo/PhotoAnalyzer.js

import { PhotoQuality } from "./PhotoTypes";

class PhotoAnalyzer {

    constructor(adapter) {

        if (!adapter) {
            throw new Error("PhotoAnalyzer requires an analysis adapter.");
        }

        this.adapter = adapter;

    }

    /**
     * Analyze a single photo.
     * @param {Object} photo
     */
    async analyze(photo) {

        this.validate(photo);

        const result = await this.adapter.analyze(photo.file);

        photo.analysis = this.normalize(result);

        return photo.analysis;

    }

    /**
     * Analyze multiple photos.
     */
    async analyzeMany(photos = []) {

        for (const photo of photos) {

            await this.analyze(photo);

        }

        return photos;

    }

    /**
     * Normalize analyzer output.
     */
    normalize(result = {}) {

        return {

            width: result.width ?? null,

            height: result.height ?? null,

            megapixels: result.megapixels ?? null,

            quality: result.quality ?? PhotoQuality.MEDIUM,

            sharpness: result.sharpness ?? null,

            brightness: result.brightness ?? null,

            contrast: result.contrast ?? null,

            blurScore: result.blurScore ?? null,

            noiseScore: result.noiseScore ?? null,

            faceCount: result.faceCount ?? 0,

            dominantColors: result.dominantColors ?? [],

            aspectRatio: result.aspectRatio ?? null

        };

    }

    hasAnalysis(photo) {

        return !!photo.analysis;

    }

    clear(photo) {

        this.validate(photo);

        photo.analysis = null;

    }

    validate(photo) {

        if (!photo)
            throw new Error("Photo is required.");

        if (!photo.file)
            throw new Error("Photo file is required.");

    }

}

export default PhotoAnalyzer;