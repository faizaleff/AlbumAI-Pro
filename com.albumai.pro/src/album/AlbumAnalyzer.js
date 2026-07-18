import MetadataService from "../services/MetadataService";
import FaceIndexService from "../services/FaceIndexService";

class AlbumAnalyzer {

    async analyze(project) {

        const report = {

            totalPhotos: project.photos.length,

            selectedPhotos: project.selectedPhotos.length,

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

        for (const photo of project.photos) {

            const metadata = await MetadataService.load(photo);

            const width = metadata.width || 0;
            const height = metadata.height || 0;

            if (width > height)
                report.landscape++;

            else if (height > width)
                report.portrait++;

            else
                report.square++;

            if (metadata.favorite)
                report.favorites++;

            if ((metadata.rating || 0) > 0)
                report.rated++;

            report.totalFaces += FaceIndexService.count(photo);

            if ((metadata.aiScore || 0) > 0)
                report.aiReady++;

        }

        return report;

    }

}

export default new AlbumAnalyzer();