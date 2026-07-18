class LayoutValidator {

    validate(layout) {

        const errors = [];

        if (!layout)
            return {
                valid: false,
                errors: ["Layout is null."]
            };

        if (!layout.id)
            errors.push("Missing layout id.");

        if (!layout.name)
            errors.push("Missing layout name.");

        if (!layout.width || layout.width <= 0)
            errors.push("Invalid layout width.");

        if (!layout.height || layout.height <= 0)
            errors.push("Invalid layout height.");

        if (!Array.isArray(layout.slots))
            errors.push("Slots must be an array.");

        if (Array.isArray(layout.slots)) {

            layout.slots.forEach((slot, index) => {

                if (!slot.id)
                    errors.push(`Slot ${index} missing id.`);

                if (slot.x == null)
                    errors.push(`Slot ${index} missing x.`);

                if (slot.y == null)
                    errors.push(`Slot ${index} missing y.`);

                if (!slot.width || slot.width <= 0)
                    errors.push(`Slot ${index} invalid width.`);

                if (!slot.height || slot.height <= 0)
                    errors.push(`Slot ${index} invalid height.`);

            });

        }

        return {

            valid: errors.length === 0,

            errors

        };

    }

    hasOverlap(layout) {

        if (!layout?.slots)
            return false;

        const slots = layout.slots;

        for (let i = 0; i < slots.length; i++) {

            for (let j = i + 1; j < slots.length; j++) {

                if (this.intersects(slots[i], slots[j]))
                    return true;

            }

        }

        return false;

    }

    intersects(a, b) {

        return !(
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y
        );

    }

    insideCanvas(layout) {

        if (!layout?.slots)
            return false;

        return layout.slots.every(slot => {

            return (

                slot.x >= 0 &&
                slot.y >= 0 &&
                slot.x + slot.width <= layout.width &&
                slot.y + slot.height <= layout.height

            );

        });

    }

}

export default new LayoutValidator();