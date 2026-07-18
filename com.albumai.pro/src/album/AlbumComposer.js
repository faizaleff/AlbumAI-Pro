class AlbumComposer {

    compose(project) {

        if (!project?.template) {
            throw new Error("No album template selected.");
        }

        const layouts = project.template.layouts ?? [];

        if (!layouts.length) {
            throw new Error("Template contains no layouts.");
        }

        const photos = [...(project.selectedPhotos ?? [])];

        const pages = [];

        let photoIndex = 0;
        let layoutIndex = 0;
        let pageNumber = 1;

        while (photoIndex < photos.length) {

            const layout =
                layouts[layoutIndex % layouts.length];

            const page = {

                id: `${layout.id}-${pageNumber}`,

                pageNumber,

                name: layout.name,

                template: layout,

                slots: []

            };

            for (const slot of layout.slots) {

                if (photoIndex >= photos.length)
                    break;

                page.slots.push({

                    slot,

                    photo: photos[photoIndex++]

                });

            }

            pages.push(page);

            layoutIndex++;
            pageNumber++;

        }

        return {

            name: project.name,

            template: project.template,

            created: new Date(),

            totalPages: pages.length,

            totalPhotos: photoIndex,

            pages

        };

    }

}

export default new AlbumComposer();