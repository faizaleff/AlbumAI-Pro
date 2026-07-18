import MetadataService from "../services/MetadataService";

class PhotoQualityEngine {

    async analyze(photo) {

        const metadata = await MetadataService.load(photo);

        const report = {

            score: 0,

            resolution: this.resolution(metadata),

            sharpness: this.sharpness(metadata),

            exposure: this.exposure(metadata),

            noise: this.noise(metadata),

            orientation: this.orientation(metadata),

            color: this.color(metadata),

            verdict: "Good"

        };

        report.score = Math.round(

            report.resolution +
            report.sharpness +
            report.exposure +
            report.noise +
            report.orientation +
            report.color

        );

        if (report.score >= 90)
            report.verdict = "Excellent";
        else if (report.score >= 75)
            report.verdict = "Good";
        else if (report.score >= 60)
            report.verdict = "Average";
        else
            report.verdict = "Poor";

        return report;

    }

    async analyzeAll(photos = []) {

        const results = [];

        for (const photo of photos) {

            results.push({

                photo,

                quality: await this.analyze(photo)

            });

        }

        return results;

    }

    resolution(metadata) {

        const width = metadata.width || 0;
        const height = metadata.height || 0;

        const mp = (width * height) / 1000000;

        return Math.min(30, mp * 2);

    }

    sharpness(metadata) {

        return metadata.sharpness ?? 20;

    }

    exposure(metadata) {

        return metadata.exposure ?? 15;

    }

    noise(metadata) {

        const value = metadata.noise ?? 15;

        return Math.max(0, 20 - value);

    }

    orientation(metadata) {

        return metadata.orientation ? 10 : 0;

    }

    color(metadata) {

        return metadata.colorScore ?? 10;

    }

    isUsable(report) {

        return report.score >= 60;

    }

    sort(results = []) {

        return [...results].sort(

            (a, b) => b.quality.score - a.quality.score

        );

    }

}

export default new PhotoQualityEngine();