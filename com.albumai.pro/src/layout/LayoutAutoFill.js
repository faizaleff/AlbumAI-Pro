import LayoutEngine from "./LayoutEngine";

class LayoutAutoFill {

    fill(page, photos = []) {

        if (!page)
            throw new Error("Page is required.");

        let photoIndex = 0;

        for (const slot of page.slots) {

            if (slot.photo)
                continue;

            if (photoIndex >= photos.length)
                break;

            slot.photo = photos[photoIndex++];

        }

        return page;

    }

    refill(page, photos = []) {

        this.clear(page);

        return this.fill(page, photos);

    }

    append(page, photos = []) {

        return this.fill(page, photos);

    }

    fillEmpty(page, photos = []) {

        return this.fill(page, photos);

    }

    balance(pages = [], photos = []) {

        let index = 0;

        for (const page of pages) {

            for (const slot of page.slots) {

                if (slot.photo)
                    continue;

                if (index >= photos.length)
                    return pages;

                slot.photo = photos[index++];

            }

        }

        return pages;

    }

    clear(page) {

        page.slots.forEach(slot => {

            slot.photo = null;

        });

        return page;

    }

    shuffle(page) {

        const photos = page.slots
            .map(slot => slot.photo)
            .filter(Boolean);

        for (let i = photos.length - 1; i > 0; i--) {

            const j = Math.floor(Math.random() * (i + 1));

            [photos[i], photos[j]] = [photos[j], photos[i]];

        }

        page.slots.forEach((slot, index) => {

            slot.photo = photos[index] || null;

        });

        return page;

    }

    autoCreate(layout, photos = []) {

        const page = LayoutEngine.create(layout);

        return this.fill(page, photos);

    }

}

export default new LayoutAutoFill();