import TemplateAnalyzer from "./TemplateAnalyzer";
import Logger from "./Logger";

export default class PhotoSlotDetector {

    constructor({

        analyzer = new TemplateAnalyzer()

    } = {}) {

        this.analyzer = analyzer;

    }

    async detect(document) {

        const template =

            await this.analyzer.analyze(

                document

            );

        const slots = [];

        let order = 1;

        for (const placeholder of template.placeholders) {

            slots.push(

                this.createSlot(

                    placeholder,

                    order++

                )

            );

        }

        slots.sort(

            (a, b) =>

                a.order - b.order

        );

        Logger.info(

            `${slots.length} photo slots detected.`

        );

        return slots;

    }

    createSlot(

        placeholder,

        order

    ) {

        return {

            id: placeholder.id,

            order,

            name: placeholder.name,

            parentId:

                placeholder.parentId,

            type: "photo",

            assigned: false,

            image: null,

            width: null,

            height: null,

            rotation: 0,

            scale: 1,

            metadata: {}

        };

    }

    assignImage(slot, image) {

        slot.image = image;

        slot.assigned = true;

        return slot;

    }

    assignImages(

        slots,

        images = []

    ) {

        const result = [];

        for (

            let i = 0;

            i < slots.length;

            i++

        ) {

            result.push(

                this.assignImage(

                    slots[i],

                    images[i] || null

                )

            );

        }

        return result;

    }

    getUnassigned(slots) {

        return slots.filter(

            slot =>

                !slot.assigned

        );

    }

    getAssigned(slots) {

        return slots.filter(

            slot =>

                slot.assigned

        );

    }

    validate(slots) {

        return {

            total: slots.length,

            assigned:

                this.getAssigned(

                    slots

                ).length,

            unassigned:

                this.getUnassigned(

                    slots

                ).length,

            complete:

                this.getUnassigned(

                    slots

                ).length === 0

        };

    }

}