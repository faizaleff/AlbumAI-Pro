import MetadataService from "../services/MetadataService";
import FaceIndexService from "../services/FaceIndexService";

class AlbumSelector {

    async select(project, options = {}) {

        const {

            maxPhotos = 300,

            minimumRating = 0,

            minimumAIScore = 0,

            favoritesFirst = true,

            requireFaces = false

        } = options;

        const candidates = [];

        for (const photo of project.photos) {

            const metadata = await MetadataService.load(photo);

            if ((metadata.rating || 0) < minimumRating)
                continue;

            if ((metadata.aiScore || 0) < minimumAIScore)
                continue;

            if (requireFaces &&
                FaceIndexService.count(photo) === 0)
                continue;

            candidates.push({

                photo,

                score: this.calculateScore(
                    metadata,
                    FaceIndexService.count(photo),
                    favoritesFirst
                )

            });

        }

        candidates.sort((a, b) => b.score - a.score);

        project.setSelectedPhotos(

            candidates
                .slice(0, maxPhotos)
                .map(item => item.photo)

        );

        return project.selectedPhotos;

    }

    calculateScore(metadata, faceCount, favoritesFirst) {

        let score = 0;

        score += (metadata.aiScore || 0);

        score += (metadata.rating || 0) * 20;

        score += faceCount * 5;

        if (favoritesFirst && metadata.favorite)
            score += 100;

        return score;

    }

}

export default new AlbumSelector();