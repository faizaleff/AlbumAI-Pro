class LayoutEngine {

    create(layout, photos = []) {

        if (!layout)
            throw new Error("Layout is required.");

        const page = {

            id: layout.id,

            name: layout.name,

            width: layout.width,

            height: layout.height,

            slots: []

        };

        for (let i = 0; i < layout.slots.length; i++) {

            page.slots.push({

                id: layout.slots[i].id,

                x: layout.slots[i].x,

                y: layout.slots[i].y,

                width: layout.slots[i].width,

                height: layout.slots[i].height,

                rotation: layout.slots[i].rotation || 0,

                photo: photos[i] || null

            });

        }

        return page;

    }

    assignPhotos(page, photos = []) {

        let index = 0;

        page.slots.forEach(slot => {

            if (index < photos.length)
                slot.photo = photos[index++];

        });

        return page;

    }

    replacePhoto(page, slotId, photo) {

        const slot = page.slots.find(

            s => s.id === slotId

        );

        if (slot)
            slot.photo = photo;

        return slot;

    }

    removePhoto(page, slotId) {

        const slot = page.slots.find(

            s => s.id === slotId

        );

        if (slot)
            slot.photo = null;

    }

    swap(page, firstId, secondId) {

        const first = page.slots.find(s => s.id === firstId);
        const second = page.slots.find(s => s.id === secondId);

        if (!first || !second)
            return;

        const temp = first.photo;

        first.photo = second.photo;

        second.photo = temp;

    }

    clear(page) {

        page.slots.forEach(

            slot => slot.photo = null

        );

    }

    isComplete(page) {

        return page.slots.every(

            slot => slot.photo !== null

        );

    }

    photoCount(page) {

        return page.slots.filter(

            slot => slot.photo

        ).length;

    }

}

export default new LayoutEngine();