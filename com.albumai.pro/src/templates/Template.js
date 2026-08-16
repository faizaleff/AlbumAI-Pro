const VALIDATION_STATE_UNKNOWN = "UNKNOWN";

export default class Template {

    constructor(analysis = {}) {

        const layerTree = analysis.layerTree || [];
        const smartObjects = analysis.smartObjects || [];
        const textLayers = analysis.textLayers || [];
        const document = {
            id: analysis.documentId ?? null,
            width: analysis.width ?? null,
            height: analysis.height ?? null,
            resolution: analysis.resolution ?? null,
            colorMode: analysis.colorMode ?? null,
            bitDepth: analysis.bitDepth ?? null
        };

        return Template.freeze({
            id: analysis.documentId ?? null,
            projectTemplateId: analysis.projectTemplateId ?? null,
            name: analysis.name || "",
            filePath: analysis.filePath || "",
            document,
            layerTree,
            smartObjects,
            textLayers,
            statistics: Template.statistics(
                layerTree,
                smartObjects,
                textLayers
            ),
            validationState: VALIDATION_STATE_UNKNOWN
        });

    }

    static statistics(layerTree, smartObjects, textLayers) {

        const layers = Template.flatten(layerTree);

        return {
            totalLayers: layers.length,
            totalGroups: layers.filter(layer =>
                (layer.children || []).length > 0
            ).length,
            totalSmartObjects: smartObjects.length,
            totalTextLayers: textLayers.length
        };

    }

    static flatten(layers, result = []) {

        for (const layer of layers) {
            result.push(layer);
            Template.flatten(layer.children || [], result);
        }

        return result;

    }

    static freeze(value) {

        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.values(value).forEach(item => Template.freeze(item));

        return Object.freeze(value);

    }

}
