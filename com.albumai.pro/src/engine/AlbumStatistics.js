class AlbumStatistics {

    generate(album) {

        if (!album)
            throw new Error("Album is required.");

        const stats = {

            totalPages: album.pages.length,

            totalSlots: 0,

            filledSlots: 0,

            emptySlots: 0,

            totalPhotos: 0,

            uniquePhotos: 0,

            duplicatePhotos: 0,

            averagePhotosPerPage: 0,

            utilization: 0

        };

        const unique = new Set();

        for (const page of album.pages) {

            stats.totalSlots += page.slots.length;

            for (const slot of page.slots) {

                if (!slot.photo)
                    continue;

                stats.filledSlots++;

                stats.totalPhotos++;

                const id =
                    slot.photo.id ||
                    slot.photo.file?.nativePath ||
                    slot.photo.name;

                if (unique.has(id))
                    stats.duplicatePhotos++;
                else
                    unique.add(id);

            }

        }

        stats.uniquePhotos = unique.size;

        stats.emptySlots =
            stats.totalSlots - stats.filledSlots;

        stats.averagePhotosPerPage =
            stats.totalPages
                ? Number(
                    (
                        stats.totalPhotos /
                        stats.totalPages
                    ).toFixed(2)
                )
                : 0;

        stats.utilization =
            stats.totalSlots
                ? Number(
                    (
                        (stats.filledSlots * 100) /
                        stats.totalSlots
                    ).toFixed(2)
                )
                : 0;

        return stats;

    }

    pageStatistics(page) {

        const filled = page.slots.filter(
            slot => slot.photo
        ).length;

        return {

            pageId: page.id,

            pageName: page.name,

            slots: page.slots.length,

            filled,

            empty: page.slots.length - filled,

            utilization:
                page.slots.length
                    ? Number(
                        (
                            (filled * 100) /
                            page.slots.length
                        ).toFixed(2)
                    )
                    : 0

        };

    }

    pages(album) {

        return album.pages.map(

            page => this.pageStatistics(page)

        );

    }

}

export default new AlbumStatistics();