import SmartObjectManager from "./SmartObjectManager";
import FileTokenManager from "../files/FileTokenManager";
import Logger from "./Logger";

export default class PhotoPlacementEngine {

    constructor({

        smartObjects = new SmartObjectManager(),

        fileTokens = new FileTokenManager()

    } = {}) {

        this.smartObjects = smartObjects;

        this.fileTokens = fileTokens;

    }

    async place({

        slots = [],

        onProgress = () => {}

    }) {

        const total = slots.length;

        let current = 0;

        for (const slot of slots) {

            current++;

            if (!slot.image) {

                Logger.warn(

                    `Slot "${slot.name}" has no assigned image.`

                );

                continue;

            }

            await this.placeImage(slot);

            onProgress({

                current,

                total,

                slot

            });

        }

        return {

            success: true,

            processed: total

        };

    }

    async placeImage(slot) {

        const token =

            await this.fileTokens.createSessionToken(

                slot.image

            );

        await this.smartObjects.replace({

            layerId: slot.id,

            fileToken: token

        });

        return {

            slotId: slot.id,

            image: slot.image.name

        };

    }

    async replace(slot, image) {

        slot.image = image;

        return this.placeImage(slot);

    }

    validate(slots = []) {

        const errors = [];

        for (const slot of slots) {

            if (!slot.id) {

                errors.push(

                    `Missing layer id (${slot.name})`

                );

            }

            if (!slot.image) {

                errors.push(

                    `Missing image (${slot.name})`

                );

            }

        }

        return {

            valid:

                errors.length === 0,

            errors

        };

    }

    async preview(slots = []) {

        return slots.map(slot => ({

            slot: slot.name,

            image:

                slot.image?.name ||

                null,

            assigned:

                !!slot.image

        }));

    }

}