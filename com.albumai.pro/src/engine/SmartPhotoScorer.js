import MetadataService from "../services/MetadataService";
import FaceIndexService from "../services/FaceIndexService";

class SmartPhotoScorer {

    async score(photo) {

        const metadata = await MetadataService.load(photo);

        let score = 0;

        score += this.scoreAI(metadata);

        score += this.scoreRating(metadata);

        score += this.scoreFavorite(metadata);

        score += this.scoreFaces(photo);

        score += this.scoreResolution(metadata);

        score += this.scoreOrientation(metadata);

        score += this.scoreRecent(metadata);

        return Math.min(1000, Math.round(score));

    }

    async scoreAll(photos = []) {

        const results = [];

        for (const photo of photos) {

            results.push({

                photo,

                score: await this.score(photo)

            });

        }

        results.sort((a, b) => b.score - a.score);

        return results;

    }

    scoreAI(metadata) {

        return metadata.aiScore || 0;

    }

    scoreRating(metadata) {

        return (metadata.rating || 0) * 30;

    }

    scoreFavorite(metadata) {

        return metadata.favorite ? 100 : 0;

    }

    scoreFaces(photo) {

        return FaceIndexService.count(photo) * 20;

    }

    scoreResolution(metadata) {

        const width = metadata.width || 0;

        const height = metadata.height || 0;

        const megapixels = (width * height) / 1000000;

        return Math.min(100, megapixels * 5);

    }

    scoreOrientation(metadata) {

        const width = metadata.width || 0;

        const height = metadata.height || 0;

        if (width > height)
            return 15;

        if (height > width)
            return 10;

        return 5;

    }

    scoreRecent(metadata) {

        if (!metadata.created)
            return 0;

        const ageDays = Math.floor(

            (Date.now() - new Date(metadata.created)) /

            (1000 * 60 * 60 * 24)

        );

        if (ageDays < 30)
            return 25;

        if (ageDays < 180)
            return 15;

        if (ageDays < 365)
            return 10;

        return 0;

    }

}

export default new SmartPhotoScorer();