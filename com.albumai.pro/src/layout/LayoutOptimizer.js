class LayoutOptimizer {

    optimize(page) {

        if (!page)
            throw new Error("Page is required.");

        this.removeDuplicates(page);

        this.sortByOrientation(page);

        return page;

    }

    removeDuplicates(page) {

        const used = new Set();

        page.slots.forEach(slot => {

            if (!slot.photo)
                return;

            const id =
                slot.photo.id ||
                slot.photo.file?.nativePath ||
                slot.photo.name;

            if (used.has(id)) {

                slot.photo = null;

                return;

            }

            used.add(id);

        });

    }

    sortByOrientation(page) {

        const landscape = [];
        const portrait = [];
        const square = [];

        page.slots.forEach(slot => {

            if (!slot.photo)
                return;

            const width = slot.photo.width || 0;
            const height = slot.photo.height || 0;

            if (width > height)
                landscape.push(slot.photo);

            else if (height > width)
                portrait.push(slot.photo);

            else
                square.push(slot.photo);

        });

        const ordered = [
            ...landscape,
            ...portrait,
            ...square
        ];

        page.slots.forEach((slot, index) => {

            slot.photo = ordered[index] || null;

        });

    }

    compact(page) {

        const photos = page.slots
            .map(slot => slot.photo)
            .filter(Boolean);

        page.slots.forEach((slot, index) => {

            slot.photo = photos[index] || null;

        });

        return page;

    }

    fillRemaining(page, photos = []) {

        let index = 0;

        page.slots.forEach(slot => {

            if (slot.photo)
                return;

            if (index >= photos.length)
                return;

            slot.photo = photos[index++];

        });

        return page;

    }

    statistics(page) {

        const total = page.slots.length;

        const filled = page.slots.filter(
            slot => slot.photo
        ).length;

        return {

            totalSlots: total,

            filledSlots: filled,

            emptySlots: total - filled,

            utilization:
                total === 0
                    ? 0
                    : Math.round((filled / total) * 100)

        };

    }

}

export default new LayoutOptimizer();