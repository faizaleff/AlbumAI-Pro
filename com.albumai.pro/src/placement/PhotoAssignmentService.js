/** Creates immutable, sequential selected-photo assignments for template slots. */
export default class PhotoAssignmentService {

    assign({ photos = [], slots = [], templateId = null, fitMode = "fill" } = {}) {

        const selectedPhotos = (Array.isArray(photos) ? photos : [])
            .filter(photo => photo?.id != null);
        const availableSlots = (Array.isArray(slots) ? slots : [])
            .filter(slot => (slot?.slotId ?? slot?.layerId) != null);
        const count = Math.min(selectedPhotos.length, availableSlots.length);
        const assignments = [];

        for (let index = 0; index < count; index += 1) {
            const photo = selectedPhotos[index];
            const slot = availableSlots[index];

            assignments.push(Object.freeze({
                photoId: photo.id,
                slotId: slot.slotId ?? slot.layerId,
                slotName: slot.slotName ?? slot.layerName ?? "",
                templateId,
                fitMode
            }));
        }

        return Object.freeze(assignments);

    }

}
