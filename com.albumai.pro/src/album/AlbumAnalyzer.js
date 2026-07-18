import MetadataService from "../services/MetadataService";
import FaceIndexService from "../services/FaceIndexService";

const CONCURRENT_BATCH = 24;

class AlbumAnalyzer {

    async analyze(project) {

        const photos = project.photos ?? [];

        const report = {

            totalPhotos: photos.length,
            selectedPhotos: project.selectedPhotos?.length ?? 0,

            landscape: 0,
            portrait: 0,
            square: 0,

            favorites: 0,
            rated: 0,

            totalFaces: 0,

            duplicates: 0,
            blurry: 0,

            aiReady: 0

        };

        for (let i = 0; i < photos.length; i += CONCURRENT_BATCH) {

            const batch = photos.slice(
                i,
                i + CONCURRENT_BATCH
            );

            const metadataBatch = await Promise.all(

                batch.map(async photo => {

                    try {

                        const metadata =
                            await MetadataService.load(photo);

                        return {
                            photo,
                            metadata
                        };

                    }

                    catch {

                        return {
                            photo,
                            metadata: {}
                        };

                    }

                })

            );

            for (const item of metadataBatch) {

                const metadata = item.metadata;

                const width = metadata.width ?? 0;
                const height = metadata.height ?? 0;

                if (width > height)
                    report.landscape++;
                else if (height > width)
                    report.portrait++;
                else
                    report.square++;

                if (metadata.favorite)
                    report.favorites++;

                if ((metadata.rating ?? 0) > 0)
                    report.rated++;

                report.totalFaces +=
                    FaceIndexService.count(item.photo);

                if ((metadata.aiScore ?? 0) > 0)
                    report.aiReady++;

                if (metadata.duplicate === true)
                    report.duplicates++;

                if (metadata.blurry === true)
                    report.blurry++;

            }

            await Promise.resolve();

        }

        return report;

    }

}

export default new AlbumAnalyzer();