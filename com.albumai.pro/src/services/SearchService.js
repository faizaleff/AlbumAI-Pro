import MetadataService from "./MetadataService";

class SearchService {

    constructor() {

        this.photos = [];

    }

    setPhotos(photos = []) {

        this.photos = photos;

    }

    async search(query = "") {

        query = query.trim().toLowerCase();

        if (!query)
            return this.photos;

        const results = [];

        for (const photo of this.photos) {

            const metadata = await MetadataService.load(photo);

            if (this.matches(photo, metadata, query)) {

                results.push(photo);

            }

        }

        return results;

    }

    matches(photo, metadata, query) {

        const text = [

            photo.name,
            metadata.extension,
            metadata.camera,
            metadata.lens,
            metadata.colorSpace,
            metadata.orientation,
            ...(metadata.tags || [])

        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

        if (text.includes(query))
            return true;

        if (query === "favorite")
            return metadata.favorite;

        if (query === "selected")
            return photo.selected;

        if (query === "raw")
            return [
                "cr2",
                "cr3",
                "nef",
                "arw",
                "raf",
                "dng",
                "orf"
            ].includes(
                (metadata.extension || "").toLowerCase()
            );

        if (query === "jpg")
            return [
                "jpg",
                "jpeg"
            ].includes(
                (metadata.extension || "").toLowerCase()
            );

        if (query === "png")
            return metadata.extension?.toLowerCase() === "png";

        const ratingMatch = query.match(/^rating([><=]+)(\d)$/);

        if (ratingMatch) {

            const op = ratingMatch[1];
            const value = Number(ratingMatch[2]);
            const rating = metadata.rating || 0;

            switch (op) {

                case "=":
                    return rating === value;

                case ">":
                    return rating > value;

                case ">=":
                    return rating >= value;

                case "<":
                    return rating < value;

                case "<=":
                    return rating <= value;

            }

        }

        const scoreMatch = query.match(/^ai([><=]+)(\d+)$/);

        if (scoreMatch) {

            const op = scoreMatch[1];
            const value = Number(scoreMatch[2]);
            const score = metadata.aiScore || 0;

            switch (op) {

                case "=":
                    return score === value;

                case ">":
                    return score > value;

                case ">=":
                    return score >= value;

                case "<":
                    return score < value;

                case "<=":
                    return score <= value;

            }

        }

        return false;

    }

}

export default new SearchService();