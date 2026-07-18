import SmartPhotoScorer from "./SmartPhotoScorer";
import DuplicateDetector from "./DuplicateDetector";
import FaceGroupingEngine from "./FaceGroupingEngine";
import EventGroupingEngine from "./EventGroupingEngine";
import PhotoQualityEngine from "./PhotoQualityEngine";

class AlbumAIEngine {

    async analyze(photos = []) {

        const [

            scores,
            quality,
            events

        ] = await Promise.all([

            SmartPhotoScorer.scoreAll(photos),

            PhotoQualityEngine.analyzeAll(photos),

            EventGroupingEngine.list(photos)

        ]);

        const duplicates =
            DuplicateDetector.group(photos);

        const faces =
            FaceGroupingEngine.group(photos);

        return {

            photos,

            scores,

            quality,

            duplicates,

            events,

            faces,

            recommendations:
                this.recommend(

                    scores,

                    quality,

                    duplicates

                )

        };

    }

    recommend(scores, quality, duplicates) {

        const recommendations = [];

        const excellent = scores.filter(

            item => item.score >= 850

        );

        if (excellent.length)

            recommendations.push({

                type: "BEST_PHOTOS",

                photos: excellent.map(

                    item => item.photo

                )

            });

        const poor = quality.filter(

            item =>

                item.quality.score < 60

        );

        if (poor.length)

            recommendations.push({

                type: "LOW_QUALITY",

                photos: poor.map(

                    item => item.photo

                )

            });

        if (duplicates.length)

            recommendations.push({

                type: "DUPLICATES",

                groups: duplicates

            });

        return recommendations;

    }

    async bestPhotos(

        photos,

        count = 300

    ) {

        const ranked =
            await SmartPhotoScorer.scoreAll(

                photos

            );

        return ranked

            .slice(0, count)

            .map(

                item => item.photo

            );

    }

    async cleanCollection(

        photos

    ) {

        const unique =
            DuplicateDetector.remove(

                photos

            );

        return this.bestPhotos(

            unique,

            unique.length

        );

    }

}

export default new AlbumAIEngine();