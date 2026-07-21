export default class PlacementResult {

    constructor(data = {}) {

        return PlacementResult.freeze({
            projectId: data.projectId ?? null,
            templateId: data.templateId ?? null,
            assignments: data.assignments || [],
            emptySlots: data.emptySlots || [],
            unassignedPhotos: data.unassignedPhotos || [],
            warnings: data.warnings || [],
            statistics: data.statistics || {},
            options: data.options || {}
        });

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => PlacementResult.freeze(item));

        return Object.freeze(value);

    }

}
