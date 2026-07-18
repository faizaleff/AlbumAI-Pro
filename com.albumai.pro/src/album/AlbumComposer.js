class AlbumComposer {

    compose(project) {

        if (!project.template)
            throw new Error("No album template selected.");

        const pages = [];

        const photos = [...project.selectedPhotos];

        const layouts = project.template.layouts || [];

        let photoIndex = 0;

        for (const layout of layouts) {

            const page = {

                id: layout.id,

                name: layout.name,

                template: layout,

                slots: []

            };

            const slotCount = layout.slots.length;

            for (let i = 0; i < slotCount; i++) {

                if (photoIndex >= photos.length)
                    break;

                page.slots.push({

                    slot: layout.slots[i],

                    photo: photos[photoIndex++]

                });

            }

            pages.push(page);

            if (photoIndex >= photos.length)
                break;

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